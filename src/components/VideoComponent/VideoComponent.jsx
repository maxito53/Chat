import React, { useState, useRef, useEffect } from 'react';
import styles from './videoComponent.module.scss';

const VideoComponent = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [signaling, setSignaling] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [pendingCandidates, setPendingCandidates] = useState([]);
  const [connectionState, setConnectionState] = useState('desconectado');
  
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    peerConnectionRef.current = peerConnection;
    localStreamRef.current = localStream;
    pendingCandidatesRef.current = pendingCandidates;
  }, [peerConnection, localStream, pendingCandidates]);

  useEffect(() => {
    console.log("Initializing WebRTC component");
    
    // iniciar el BroadcastChannel
    const channel = new BroadcastChannel('webrtc');
    setSignaling(channel);

    // limpiar lo desmontado
    return () => {
      console.log("Cleaning up WebRTC component");
      cleanupConnection();
      if (channel) {
        channel.close();
      }
    };
  }, []);

  // iniciar mensajes de tipo de peticiones
  useEffect(() => {
    if (!signaling) return;
    
    const handleMessage = (e) => {
      const data = e.data;
      console.log(`Received ${data.type} message`, data);
      
      switch (data.type) {
        case 'offer':
          handleOffer(data);
          break;
        case 'answer':
          handleAnswer(data);
          break;
        case 'candidate':
          handleCandidate(data);
          break;
        case 'ready':
          handleReady();
          break;
        case 'bye':
          handleBye();
          break;
        default:
          console.log('Unhandled message', data);
          break;
      }
    };
    
    signaling.onmessage = handleMessage;
    
    return () => {
      signaling.onmessage = null;
    };
  });

  const getLocalStream = async () => {
    if (localStreamRef.current) {
      console.log("Already have local stream");
      return localStreamRef.current;
    }
    
    try {
      console.log("Requesting user media");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: true 
      });
      console.log("Got local stream", stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setLocalStream(stream);
      setIsConnected(true);
      return stream;
    } catch (error) {
      console.error("Error getting user media:", error);
      console.log(connectionState);
      setConnectionState('error: ' + error.message);
      return null;
    }
  };

  const startVideoCall = async () => {
    const stream = await getLocalStream();
    if (!stream) return;
    
    // notificar que ya está
    if (signaling) {
      console.log("Sending ready signal");
      signaling.postMessage({ type: 'ready' });
    }
  };

  const handleReady = async () => {
    console.log("Received ready signal, initiating call");
    const stream = await getLocalStream();
    if (!stream) return;
    
    await createPeerConnectionAndOffer();
  };
  
  const handleBye = () => {
    console.log("Received bye signal");
    //cleanupConnection();
  };

  const cleanupConnection = () => {
    console.log("Cleaning up connection");
    
    // cerrar peer connection si existe
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      setPeerConnection(null);
    }
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    setConnectionState('desconectado');
    setPendingCandidates([]);
  };

  const endCall = () => {
    if (signaling) {
      signaling.postMessage({ type: 'bye' });
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      
      setLocalStream(null);
      setIsConnected(false);
    }
    
    cleanupConnection();
  };

  const createPeerConnection = async () => {
    console.log("Creating peer connection");
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ]
    });
    
    setConnectionState('conectando');
    
    pc.onicecandidate = (event) => {
      if (signaling) {
        const message = {
          type: 'candidate',
          candidate: event.candidate ? event.candidate.candidate : null,
          sdpMid: event.candidate ? event.candidate.sdpMid : null,
          sdpMLineIndex: event.candidate ? event.candidate.sdpMLineIndex : null
        };
        
        console.log(`Sending ICE candidate`, message);
        signaling.postMessage(message);
      }
    };
    
    pc.ontrack = (event) => {
      console.log("Received remote track", event.streams);
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
    
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state: ${pc.iceConnectionState}`);
      setConnectionState(pc.iceConnectionState);
    };
    
    const stream = await getLocalStream();
    if (!stream) {
      console.error("Failed to get local stream for peer connection");
      return null;
    }
    
    stream.getTracks().forEach(track => {
      console.log(`Adding ${track.kind} track to peer connection`);
      pc.addTrack(track, stream);
    });
    
    setPeerConnection(pc);
    return pc;
  };

  const createPeerConnectionAndOffer = async () => {
    const pc = await createPeerConnection();
    if (!pc) return;
    
    try {
      console.log("Creating offer");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log("Sending offer", offer);
      if (signaling) {
        signaling.postMessage({
          type: 'offer',
          sdp: offer.sdp
        });
      }
    } catch (error) {
      console.error("Error creating offer:", error);
      setConnectionState('error: ' + error.message);
    }
  };

  const handleOffer = async (offerData) => {
    console.log("Handling offer");
    
    await getLocalStream();
    
    // crear nueva conexión peer
    const pc = await createPeerConnection();
    if (!pc) return;
    
    try {
      console.log("Setting remote description (offer)");
      await pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: offerData.sdp
      }));
      
      if (pendingCandidatesRef.current.length > 0) {
        console.log(`Processing ${pendingCandidatesRef.current.length} pending ICE candidates`);
        for (const candidateData of pendingCandidatesRef.current) {
          await addIceCandidate(pc, candidateData);
        }
        setPendingCandidates([]);
      }
      
      console.log("Creating answer");
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      console.log("Sending answer");
      if (signaling) {
        signaling.postMessage({
          type: 'answer',
          sdp: answer.sdp
        });
      }
    } catch (error) {
      console.error("Error handling offer:", error);
      setConnectionState('error: ' + error.message);
    }
  };

  const handleAnswer = async (answerData) => {
    console.log("Handling answer");
    
    if (!peerConnectionRef.current) {
      console.error("No peer connection when receiving answer");
      return;
    }
    
    try {
      console.log("Setting remote description (answer)");
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: answerData.sdp
      }));
    } catch (error) {
      console.error("Error handling answer:", error);
      setConnectionState('error: ' + error.message);
    }
  };

  const addIceCandidate = async (pc, candidateData) => {
    try {
      if (!candidateData.candidate) {
        console.log("Adding null ICE candidate (end of candidates)");
        await pc.addIceCandidate(null);
      } else {
        console.log("Adding ICE candidate", candidateData);
        await pc.addIceCandidate(new RTCIceCandidate({
          candidate: candidateData.candidate,
          sdpMid: candidateData.sdpMid,
          sdpMLineIndex: candidateData.sdpMLineIndex
        }));
      }
    } catch (error) {
      console.error("Error adding ICE candidate:", error);
    }
  };

  const handleCandidate = async (candidateData) => {
    console.log("Handling ICE candidate", candidateData);
    
    if (!peerConnectionRef.current) {
      console.log("No peer connection yet, storing ICE candidate for later");
      setPendingCandidates(prev => [...prev, candidateData]);
      return;
    }
    
    await addIceCandidate(peerConnectionRef.current, candidateData);
  };

  

  return (
    <div className={styles.videoContainer}>
      <div className={styles.videoWrapper}>
        <video 
          ref={localVideoRef} 
          className={styles.localVideo} 
          autoPlay 
          playsInline 
          muted
        />
        <video 
          ref={remoteVideoRef} 
          className={styles.remoteVideo} 
          autoPlay 
          playsInline
        />
      </div>
      <div className={styles.controlsContainer}>
        {!isConnected ? (
          <button 
            className={styles.startButton} 
            onClick={startVideoCall}
          >
            Iniciar Video
          </button>
        ) : (
          <button 
            className={styles.hangupButton} 
            onClick={endCall}
          >
            Finalizar Llamada
          </button>
        )}
      </div>
      <div className={styles.instructions}>
        <p>Abre esta página en dos pestañas diferentes para iniciar una videollamada</p>
        <p><strong>Instrucciones:</strong></p>
        <ol>
          <li>Haz clic en "Iniciar Video" en ambas pestañas</li>
          <li>Acepta los permisos de cámara y micrófono en ambas pestañas</li>
          <li>Espera a que se establezca la conexión automáticamente</li>
        </ol>
      </div>
    </div>
  );
};

export default VideoComponent;