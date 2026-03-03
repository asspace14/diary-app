// speech.js
// Handles Web Speech API operations

export class SpeechApp {
    constructor(onResult, onEnd, onError) {
        this.onResult = onResult;
        this.onEnd = onEnd;
        this.onError = onError;

        this.isRecording = false;

        // Check browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            this.supported = false;
            console.error("Speech Recognition API is not supported in this browser.");
            return;
        }

        this.supported = true;
        this.recognition = new SpeechRecognition();

        // Options
        this.recognition.lang = 'ja-JP';
        this.recognition.interimResults = true; // Get results while speaking
        this.recognition.continuous = true; // Keep listening

        // Event listeners
        this.recognition.onstart = () => {
            this.isRecording = true;
        };

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (this.onResult) {
                this.onResult(finalTranscript, interimTranscript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            this.isRecording = false;
            if (this.onError) {
                this.onError(event.error);
            }
        };

        this.recognition.onend = () => {
            this.isRecording = false;
            if (this.onEnd) {
                this.onEnd();
            }
        };
    }

    start() {
        if (!this.supported) return false;

        try {
            this.recognition.start();
            return true;
        } catch (e) {
            console.error("Could not start recognition", e);
            return false;
        }
    }

    stop() {
        if (!this.supported || !this.isRecording) return;
        this.recognition.stop();
    }

    toggle() {
        if (this.isRecording) {
            this.stop();
        } else {
            this.start();
        }
        return this.isRecording;
    }
}
