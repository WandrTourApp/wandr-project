/**
 * Content Analyzer for Lost Transmissions
 * Extracts location, mood, theme, sentiment, and vocal frequency profile from voice content.
 * This class serves as the intelligence layer for automated audio selection and mixing.
 */

const speech = require('@google-cloud/speech'); // For Speech-to-Text conversion
const fs = require('fs').promises; // For file system operations
const natural = require('natural'); // For Natural Language Processing (Sentiment, Tokenization)
const path = require('path'); // For resolving file paths dynamically
const VocalAnalyzer = require('../../optimization/algorithms/vocal-analyzer'); // NEW: Import VocalAnalyzer

// Configure Natural.js Sentiment Analyzer
// Using 'afinn' vocabulary for a simple sentiment score (typically -5 to +5 range)
const Analyzer = natural.SentimentAnalyzer;
const stemmer = natural.PorterStemmer; // Used for stemming words before sentiment analysis
const sentimentAnalyzer = new Analyzer("English", stemmer, "afinn");

class ContentAnalyzer {
    constructor() {
        this.speechClient = new speech.SpeechClient(); // Google Cloud Speech-to-Text client
        
        // Dynamically load keyword configuration files
        this.locationKeywords = require(path.join(__dirname, '../config/location-keywords.json'));
        this.moodKeywords = require(path.join(__dirname, '../config/mood-keywords.json'));
        
        this.vocalAnalyzer = new VocalAnalyzer(); // Initialize the VocalAnalyzer for frequency profiling
    }

    /**
     * Main analysis function: Takes an audio file and extracts comprehensive content information.
     * @param {string} audioFilePath Path to the ElevenLabs voice MP3 file.
     * @returns {Promise<Object>} An object containing transcript, location, mood, sentiment, vocal profile, etc.
     */
    async analyze(audioFilePath) {
        try {
            // 1. Get audio duration from the file (using ffprobe)
            const duration = await this.getAudioDuration(audioFilePath);
            
            // 2. Convert speech to text using Google Speech-to-Text API
            const transcript = await this.speechToText(audioFilePath);
            
            // 3. Analyze vocal frequency profile using the VocalAnalyzer
            const vocalProfile = await this.vocalAnalyzer.analyze(audioFilePath);
            console.log('🗣️ Vocal profile analyzed:', vocalProfile);

            // 4. Extract key information and enrich the analysis object
            const analysis = {
                transcript: transcript,
                location: this.extractLocation(transcript), // Basic keyword-based location
                mood: this.extractMood(transcript),         // Basic keyword-based mood
                intensity: null,                            // Will be refined based on sentiment
                theme: this.extractTheme(transcript),       // Basic keyword-based theme
                keywords: this.extractKeywords(transcript), // General keywords
                duration: duration,
                setting: this.extractSetting(transcript),   // Indoor/Outdoor, Day/Night inference
                sentimentScore: this.getSentimentScore(transcript), // Numerical sentiment score
                vocalProfile: vocalProfile                  // Detailed vocal frequency profile
            };
            
            // Refine the mood and intensity based on the sentiment score for more nuance
            this.refineMoodAndIntensity(analysis);

            return analysis;
            
        } catch (error) {
            console.error('❌ Content analysis failed:', error);
            // Return a default analysis object if any part of the process fails,
            // to prevent the entire system from crashing.
            return this.getDefaultAnalysis(error);
        }
    }

    /**
     * Converts an audio file's speech content into text using Google Speech-to-Text API.
     * @param {string} audioFilePath The path to the audio file (e.g., MP3 from ElevenLabs).
     * @returns {Promise<string>} The transcribed text.
     */
    async speechToText(audioFilePath) {
        const audioBytes = await fs.readFile(audioFilePath); // Read audio file as bytes
        
        const request = {
            audio: { content: audioBytes.toString('base64') }, // Base64 encode the audio
            config: {
                encoding: 'MP3', // Specify the audio encoding (assuming ElevenLabs outputs MP3)
                sampleRateHertz: 16000, // Common sample rate for voice; confirm ElevenLabs output SR
                languageCode: 'en-US', // Language of the speech
                enableAutomaticPunctuation: true, // Improve readability of transcript
                model: 'latest_long' // Optimized model for longer audio and higher accuracy
            }
        };
        
        // Send the recognition request to Google Cloud Speech-to-Text
        const [response] = await this.speechClient.recognize(request);
        // Concatenate all transcribed alternatives into a single string
        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');
            
        return transcription;
    }

    /**
     * Extracts a primary location from the transcript using predefined keywords.
     * This is a basic keyword matching approach, expandable with more advanced NLP later.
     * @param {string} transcript The text content of the audio.
     * @returns {string} The detected location (e.g., 'forest', 'urban', 'unknown').
     */
    extractLocation(transcript) {
        const text = transcript.toLowerCase(); // Case-insensitive matching
        
        for (const [location, keywords] of Object.entries(this.locationKeywords)) {
            for (const keyword of keywords) {
                if (text.includes(keyword.toLowerCase())) {
                    return location;
                }
            }
        }
        return 'unknown'; // Default if no specific location is found
    }

    /**
     * Extracts a primary mood from the transcript using predefined keywords.
     * This is a basic keyword matching approach, which will be refined by sentiment analysis.
     * @param {string} transcript The text content of the audio.
     * @returns {string} The detected mood (e.g., 'mysterious', 'adventurous').
     */
    extractMood(transcript) {
        const text = transcript.toLowerCase();
        let moodScores = {}; // To score different moods
        
        for (const [mood, keywords] of Object.entries(this.moodKeywords)) {
            moodScores[mood] = 0;
            keywords.forEach(keyword => {
                if (text.includes(keyword.toLowerCase())) {
                    moodScores[mood]++; // Increment score if keyword is found
                }
            });
        }
        
        // Determine the mood with the highest score
        const dominantMood = Object.keys(moodScores).reduce((a, b) => 
            moodScores[a] > moodScores[b] ? a : b
        );
        // Fallback to 'mysterious' if no specific mood keywords are strongly matched,
        // aligning with Miles Wandr's character.
        return dominantMood === 'unknown' ? 'mysterious' : dominantMood;
    }

    /**
     * Calculates a sentiment score for the transcript using Natural.js.
     * @param {string} transcript The text content of the audio.
     * @returns {number} A numerical sentiment score (e.g., positive values for positive, negative for negative).
     */
    getSentimentScore(transcript) {
        const tokens = new natural.WordTokenizer().tokenize(transcript); // Tokenize the transcript into words
        // Get the sentiment score from the tokenized words
        return sentimentAnalyzer.getSentiment(tokens);
    }

    /**
     * Refines the detected mood and intensity based on the sentiment score.
     * This provides a more nuanced understanding beyond simple keyword matching.
     * @param {Object} analysis The analysis object to be refined.
     */
    refineMoodAndIntensity(analysis) {
        const score = analysis.sentimentScore;

        // Apply rules based on the sentiment score
        if (score > 0.5) { // Strongly positive sentiment
            analysis.mood = 'peaceful'; // Suggests calm, resolution
            analysis.intensity = 'high'; // Can be high for positive excitement too
        } else if (score > 0.1) { // Mildly positive sentiment
            analysis.mood = 'adventurous'; // Suggests forward-looking, exploration
            analysis.intensity = 'medium';
        } else if (score < -0.5) { // Strongly negative sentiment
            analysis.mood = 'tense'; // Suggests danger, suspense, or sadness
            analysis.intensity = 'high';
        } else if (score < -0.1) { // Mildly negative sentiment
            analysis.mood = 'mysterious'; // Suggests slight unease, intrigue
            analysis.intensity = 'medium';
        } else { // Neutral sentiment (score close to zero)
            // If the keyword-based mood is 'unknown' or very generic,
            // default to 'historical' for Miles Wandr's neutral narrative.
            if (!analysis.mood || analysis.mood === 'unknown') {
                 analysis.mood = 'historical'; 
            }
            analysis.intensity = 'low'; // Neutral content often implies lower intensity
        }
    }

    /**
     * Extracts an overarching theme from the transcript using simple keyword detection.
     * Will be enhanced with more advanced NLP (e.g., topic modeling) in the future.
     * @param {string} transcript The text content of the audio.
     * @returns {string} The detected theme (e.g., 'discovery').
     */
    extractTheme(transcript) {
        const text = transcript.toLowerCase();
        // Simple keyword checks for theme detection
        if (text.includes("ancient") || text.includes("ruins") || text.includes("discovery") || text.includes("lost artifact")) {
            return "discovery"; // Aligns with Miles Wandr's narrative
        }
        return 'discovery'; // Default theme for Miles Wandr
    }

    /**
     * Extracts general keywords from the transcript.
     * Uses Natural.js for tokenization and stopword removal for cleaner keywords.
     * @param {string} transcript The text content of the audio.
     * @returns {Array<string>} An array of the top 10 most frequent keywords.
     */
    extractKeywords(transcript) {
        const text = transcript.toLowerCase();
        const tokenizer = new natural.WordTokenizer();
        const tokens = tokenizer.tokenize(text); // Tokenize words
        const stopwords = new Set(natural.stopwords); // Use Natural.js's built-in stopword list
        
        // Filter out stopwords and very short tokens (e.g., single letters)
        const filteredTokens = tokens.filter(token => !stopwords.has(token) && token.length > 2);
        
        // Count keyword frequencies
        const keywordCounts = {};
        filteredTokens.forEach(token => {
            keywordCounts[token] = (keywordCounts[token] || 0) + 1;
        });

        // Sort by frequency and return the top 10 keywords
        return Object.keys(keywordCounts).sort((a, b) => keywordCounts[b] - keywordCounts[a]).slice(0, 10);
    }

    /**
     * Infers the setting (e.g., 'indoor', 'outdoor', 'day', 'night') from the transcript.
     * This is based on simple keyword detection for initial inference.
     * @param {string} transcript The text content of the audio.
     * @returns {string} The inferred setting.
     */
    extractSetting(transcript) {
        const text = transcript.toLowerCase();
        // Check for indoor cues
        if (text.includes("inside") || text.includes("room") || text.includes("shelter") || text.includes("cave") || text.includes("building")) {
            return "indoor";
        }
        // Check for night cues
        if (text.includes("night") || text.includes("stars") || text.includes("moon") || text.includes("darkness")) {
            return "night";
        }
        // Default to outdoor for an explorer character
        return 'outdoor';
    }

    /**
     * Gets the duration of an audio file using FFmpeg's ffprobe.
     * @param {string} audioFilePath The path to the audio file.
     * @returns {Promise<number>} The duration of the audio in seconds.
     */
    async getAudioDuration(audioFilePath) {
        return new Promise((resolve, reject) => {
            const ffmpegStatic = require('fluent-ffmpeg'); // Use local instance for ffprobe
            ffmpegStatic.ffprobe(audioFilePath, (err, metadata) => {
                if (err) {
                    console.error('Error getting audio duration:', err);
                    reject(err);
                } else {
                    resolve(metadata.format.duration); // Return duration in seconds
                }
            });
        });
    }

    /**
     * Provides a default analysis object, used as a fallback if analysis fails.
     * @param {Error} [error=null] Optional error object if analysis failed.
     * @returns {Object} A default analysis object.
     */
    getDefaultAnalysis(error = null) {
        console.warn(`Returning default analysis due to error: ${error ? error.message : 'Unknown error'}`);
        return {
            location: 'unknown',
            mood: 'mysterious',
            intensity: 'medium',
            theme: 'discovery',
            setting: 'outdoor',
            keywords: [],
            duration: 0,
            sentimentScore: 0,
            // Ensure vocalProfile is also provided as a default if VocalAnalyzer failed or isn't initialized
            vocalProfile: this.vocalAnalyzer ? this.vocalAnalyzer.getDefaultVocalProfile() : { dominantFrequency: 0, averageEnergyByBand: { low: 0, mid: 0, high: 0 }, peakFrequencies: [] }
        };
    }
}

module.exports = ContentAnalyzer;
