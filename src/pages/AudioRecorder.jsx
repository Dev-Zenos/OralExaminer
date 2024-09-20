import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Play, Square, Repeat } from 'lucide-react';

export default function AudioRecorder({code, participant}) {
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState(null);
    const [isError, setIsError] = useState(true);
    const [microphone, setMicrophone] = useState(false);
    const [audioURL, setAudioURL] = useState(null);
    const [finished, setFinished] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [countdown, setCountdown] = useState(0); // New state for countdown
    const [timer, setTimer] = useState(0); // New state for timer
    const [statusInterval, setStatusInterval] = useState(null);
    const mediaRecorder = useRef(null);
    const audioRef = useRef(null);
    let questionIndex;

    async function sendStatus() {

        if (mediaRecorder.current && mediaRecorder.current.state === 'inactive' && !playing && !isRecording) {
            setTimer(0);
            return;
        }
        

        const response = await fetch(`https://backend-4abv.onrender.com/check_status?code=${code}&participant=${participant}`);
        if (!response.ok) {
            setError('Failed to fetch status');
            setIsError(true);
            return;
        }

        const data = await response.json();

        console.log('Response:', data);

        const responseCode = data.code;

        if (data.time) {
            updateTimer(data.time);
        }

        switch (responseCode) {
            case 1:
                window.location.href = 'join-room';
                break;
            case 2:
                window.location.href = 'join-room';
                break;
            case 3:
                break;
            case 4:
                window.location.href = 'join-room';
                break;
            case 5:
                if (error == 'Reaching time limit. Please finish your response in the next 5 seconds. ') {setError('You reached the time limit and your audio was stopped and uploaded automatically. It may take anywhere from 10 seconds to a few minutes to process your audio depending on how many other students are ahead in the queue.'); setIsError(false)}
                stopRecording();
                break;
            case 6:
                if ((!(error == 'Processing... This may take anywhere from 10 seconds to a few minutes depending on how many other students are ahead in the queue.') && (!error || error === null || !(error.includes('Uploaded to server successfully.'))))) {
                    setError('Reaching time limit. Please finish your response in the next 5 seconds. ');
                    
                    setIsError(true);
                }
                break;
            default:
                window.location.href = 'join-room';
                break;
        }
    }

    const makeResponse = async() =>  {
        const response = await fetch(`https://backend-4abv.onrender.com/receiveaudio?code=${code}&participant=${participant}&number=1`);
        if (!response.ok) {
            setError('Failed to fetch audio');
            setIsError(true);
            return;
        }

        const receivedData = await response.json();

        console.log('Received data:', receivedData.audios);

        const audios = receivedData.audios;

        let audio;

        for (const data of audios) {

            console.log('Response:', data);

            const audioData = Uint8Array.from(atob(data), c => c.charCodeAt(0));
            const blob = new Blob([audioData], { type: 'audio/ogg; codecs=opus' });
            const audioUrl = URL.createObjectURL(blob);

            audio = new Audio(audioUrl);

            console.log("Audio: " + audio);

            questionIndex = receivedData.questionIndex;
        }

        return audio;

    }

    let audio = null;

    let interval = null;

    const getAudio = async() => {
        await sendStatus();
        interval = setInterval(sendStatus, 1000);
        audio = await makeResponse();
    }

    const getSupportedMimeType = () => {
        const types = ['audio/webm', 'audio/ogg', 'audio/mp4'];
        for (let type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            return type;
        }
        }
        return null;
    };

    const requestMicrophonePermission = async () => {
        try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicrophone(true);
        setError(null);
        return true;
        } catch (err) {
        console.error('Error requesting microphone permission:', err);
        setError('Microphone access is required. Click here to try again.');
        setIsError(true);
        return false;
        }
    };

    let chunks = [];

    const startRecording = async () => {
        setIsRecording(true);
        setAudioURL(null);
        const permissionGranted = await requestMicrophonePermission();
        if (!permissionGranted) return;

        await fetch(`https://backend-4abv.onrender.com/started_playing_audio?code=${code}&participant=${participant}`);

        const mimeType = getSupportedMimeType();
        if (!mimeType) {
        setError('Your browser does not support any of the available audio recording formats.');
        setIsError(true);
        return;
        }

        try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder.current = new MediaRecorder(stream, { mimeType });
        
        mediaRecorder.current.ondataavailable = (e) => chunks.push(e.data);
        
        mediaRecorder.current.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/wav' });
            const formData = new FormData();
            formData.append('audio', blob, 'audio.wav');
            Upload(formData);
            console.log('Blob:', blob);
            const audioUrl = URL.createObjectURL(blob);
            setAudioURL(audioUrl);
            setIsRecording(false);
        };

        mediaRecorder.current.start();

      
        } catch (err) {
        console.error('Error starting recording:', err);
        setError('An error occurred while starting the recording. Please try again.');
        setIsError(true);
        }
    };

    const Upload = async(formData) => {
        setError('Processing... This may take anywhere from 10 seconds to a few minutes depending on how many other students are ahead in the queue.');
        setIsError(false);
        let transcriptionResult = {textContent: ""};
        let response = await fetch(`https://backend-4abv.onrender.com/upload?code=${code}&participant=${participant}&index=${questionIndex}`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            transcriptionResult.textContent = 'Failed to upload audio. Retrying until success...';
            const retryInterval = setInterval(async () => {
                let retryResponse = await fetch(`https://backend-4abv.onrender.com/upload?code=${code}&participant=${participant}&index=${questionIndex}`, {
                    method: 'POST',
                    body: formData
                });
                if (retryResponse.ok) {
                    clearInterval(retryInterval);
                    const data = await response.json();

                    console.log('Response:', data);

                    if (data.error) {
                        transcriptionResult.textContent = data.error;
                        return;
                    }

                    if (transcriptionResult.textContent == 'Processing... This may take anywhere from 10 seconds to a few minutes depending on how many other students are ahead in the queue.')
                        transcriptionResult.textContent = '';

                    transcriptionResult.textContent = transcriptionResult.textContent + 'Uploaded to server successfully. Tentative transcription: ' + data.transcription;

                    clearInterval(statusInterval);

                    setTimeout(() => {
                        const popupWindow = window.open(`feedback?name=${participant}&code=${code}`, 'Feedback', 'width=600,height=400');
                        if (popupWindow) {
                            popupWindow.focus();
                        }    
                    }, 3000);

                    return;

                }
            }, 10000);
        }

        const data = await response.json();

        console.log('Response:', data);

        if (data.error) {
            transcriptionResult.textContent = data.error;
            setError(transcriptionResult.textContent);
            setIsError(true);
            return;
        }

        if (transcriptionResult.textContent === 'Processing... This may take anywhere from 10 seconds to a few minutes depending on how many other students are ahead in the queue.')
            transcriptionResult.textContent = '';

        if (transcriptionResult.textContent === 'You reached the time limit and your audio was stopped and uploaded automatically. It may take anywhere from 10 seconds to a few minutes to process your audio depending on how many other students are ahead in the queue.') 
            transcriptionResult.textContent = '';

        transcriptionResult.textContent = transcriptionResult.textContent + 'Uploaded to server successfully. Tentative transcription: ' + data.transcription;
        setIsError(false);

        console.log("Bob: " + transcriptionResult.textContent);
        setError(transcriptionResult.textContent);
    }

    const playRecording = async() => {
        if (!audio)
            await getAudio();
        console.log("Audio: " + audio);
        audio.play();
        setPlaying(true);
        audio.onended = () => {
            setFinished(true);
            setPlaying(false);
            // Countdown logic
            setCountdown(5);
            const countdownInterval = setInterval(() => {
                setCountdown(prev => {
                    if (prev === 1) {
                        clearInterval(countdownInterval);
                        setFinished(false);
                        startRecording();        
                    }
                    return prev - 1;
                });
            }, 1000);
            
        }
    };

    const stopRecording = () => {

        console.log('Stopping recording...');

        setFinished(true);
        setIsRecording(false);

        
        if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
            mediaRecorder.current.stop();            
        }
    }

    const updateTimer = (time) => {
        setTimer(time);
    };

    const formatTime = (time) => {
        if (time === 0)
            return 'xx:xx';
        const minutes = Math.floor(time / 60000);
        const seconds = Math.floor((time % 60000) / 1000);

        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const interval = setInterval(() => {
            setTimer(prev => prev > 0 ? prev - 1 : 0);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transform: 'translateY(-10%)',
            padding: '20px',
            minHeight: '100vh',
        }}>
            {/* Timer display at the top */}
            <div style={{
                position: 'absolute',
                top: '20px',
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#374151',
            }}>
                {formatTime(timer)}
            </div>
            {/* New outer rounded container */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'white', // White background for the rounded box
                padding: '40px', // Increase padding for the inner content
                borderRadius: '24px', // Larger rounded corners
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', // Add a shadow for better visibility
                width: '90%', // Adjust width to fit content nicely
                maxWidth: '600px', // Set a max width for the box
                textAlign: 'center',
            }}>
                <h1 style={{
                    fontSize: '32px',
                    fontWeight: '700',
                    color: '#374151',
                    marginBottom: '16px',
                }}>
                    Oral Exam Assistant
                </h1>
                { finished ? (null) : (
                <button
                    onClick={isRecording ? stopRecording : playRecording}
                    style={{
                        width: '128px',
                        height: '128px',
                        borderRadius: '50%',
                        backgroundColor: isRecording ? '#EF4444' : '#28a745',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.3s',
                    }}
                >
                    {isRecording ? <Square size={64} color="white" /> : <Play size={64} color="white" />}
                </button>
                )
                }
                
                {isRecording && (
                    <p style={{
                        marginTop: '16px',
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#374151',
                    }}>
                        Recording...
                    </p>
                )}

                {playing && (
                    <p style={{
                        marginTop: '16px',
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#28a745',
                    }}>
                        Playing...
                    </p>
                )}

                {countdown > 0 && (
                    <p style={{
                        marginTop: '16px',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: 'red',
                    }}>
                        Recording starts in {countdown}...
                    </p>
                )}
                
                {error && (
                    <div 
                        onClick={microphone ? (null) : (requestMicrophonePermission)}
                        style={isError ? (
                            {
                                marginTop: '24px', // Increase top margin for spacing
                                padding: '16px',
                                backgroundColor: '#FEE2E2',
                                borderRadius: '12px', // Larger rounded corners for the error box
                                border: '1px solid #F87171',
                                color: '#B91C1C',
                                cursor: 'pointer',
                                maxWidth: '80%', // Adjust width to fit inside the parent container
                            }
                        ) : (
                            {
                                marginTop: '24px', // Increase top margin for spacing
                                padding: '16px',
                                backgroundColor: '#D1FAE5',
                                borderRadius: '12px', // Larger rounded corners for the error box
                                border: '1px solid #34D399',
                                color: '#065F46',
                                cursor: 'pointer',
                                maxWidth: '80%', // Adjust width to fit inside the parent container
                            }
                        )}
                    >
                        <p style={{ margin: '5px' }}>{error}</p>
                    </div>
                )}
            </div>
        </div>
    );
}