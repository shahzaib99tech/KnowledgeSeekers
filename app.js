document.addEventListener('DOMContentLoaded', function() {
    // --- 1. Intersection Observer for Fade-In Animation ---
    const fadeElements = document.querySelectorAll('.fade-in');

    const observerOptions = {
        root: null, 
        rootMargin: '0px',
        threshold: 0.1 
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); 
            }
        });
    }, observerOptions);

    fadeElements.forEach(el => {
        observer.observe(el);
    });

    // --- 2. Active Navigation Link Highlighting ---
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    const sections = document.querySelectorAll('section');

    window.addEventListener('scroll', () => {
        let current = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (pageYOffset >= sectionTop - sectionHeight / 3) { 
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').includes(current)) {
                link.classList.add('active');
            }
        });
    });
    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- GLOBAL VARIABLES ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

if (!firebaseConfig) {
    console.error("Firebase configuration is missing. Cannot initialize Firestore.");
}

// --- FIREBASE INITIALIZATION & AUTH ---
let db;
let auth;
let currentUserId = null;

if (firebaseConfig) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("Firebase initialized.");
    
    // Auth function
    const authenticateUser = async () => {
        try {
            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
            } else {
                await signInAnonymously(auth);
            }
        } catch (error) {
            console.error("Firebase authentication failed:", error);
        }
    };

    // Listen for auth state change
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserId = user.uid;
            // Ensure element exists before accessing
            const userIdDisplay = document.getElementById('userIdDisplay');
            if (userIdDisplay) userIdDisplay.textContent = currentUserId;

            setupRealtimeTestimonials();
            console.log("User authenticated:", currentUserId);
        } else {
            console.log("User signed out or anonymous sign-in failed.");
            // Try to sign in if not authenticated
            authenticateUser();
        }
    });
}


// --- FORM SUBMISSION LOGIC ---

const form = document.getElementById('testimonialForm');
const responseMessage = document.getElementById('responseMessage');
const submitBtn = document.getElementById('submitBtn');

// Only add the listener if the form element exists
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!db || !currentUserId) {
            if (responseMessage) responseMessage.textContent = "Error: Database not ready or user not authenticated.";
            return;
        }

        const name = document.getElementById('name')?.value.trim();
        const course = document.getElementById('course')?.value.trim();
        const feedback = document.getElementById('feedback')?.value.trim();

        if (!name || !course || !feedback || course === "") {
             if (responseMessage) responseMessage.textContent = "Please fill in all fields.";
            return;
        }

        if (feedback.length > 300) {
            if (responseMessage) responseMessage.textContent = "Testimonial is too long (max 300 characters).";
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Sending...";
        }
        if (responseMessage) responseMessage.textContent = "";

        try {
            // Path: /artifacts/{appId}/public/data/testimonials
            const testimonialsCollectionPath = `artifacts/${appId}/public/data/testimonials`;
            
            await addDoc(collection(db, testimonialsCollectionPath), {
                name: name,
                course: course,
                feedback: feedback,
                userId: currentUserId,
                timestamp: serverTimestamp()
            });

            if (responseMessage) {
                responseMessage.style.color = '#28a745';
                responseMessage.textContent = "Thank you! Your testimonial has been submitted and is now live!";
            }
            form.reset();

        } catch (error) {
             if (responseMessage) {
                responseMessage.style.color = '#dc3545';
                responseMessage.textContent = "Submission failed. Please try again.";
            }
            console.error("Error submitting testimonial:", error);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Submit Testimonial";
            }
        }
    });
}


// --- REAL-TIME DISPLAY LOGIC ---

function createTestimonialHTML(data) {
    const card = document.createElement('div');
    card.className = 'testimonial-card';
    card.innerHTML = `
        <p>"${data.feedback}"</p>
        <div class="student-info">
            <h4>— ${data.name}</h4>
            <p>${data.course}</p>
        </div>
    `;
    return card;
}

function setupRealtimeTestimonials() {
    // Stop the function if the database isn't ready
    if (!db) return;

    const liveTestimonialsContainer = document.getElementById('liveTestimonials');
    if (!liveTestimonialsContainer) return;

    // Path: /artifacts/{appId}/public/data/testimonials
    const testimonialsCollectionPath = `artifacts/${appId}/public/data/testimonials`;
    const q = query(collection(db, testimonialsCollectionPath));

    onSnapshot(q, (snapshot) => {
        // Clear existing static testimonials
        liveTestimonialsContainer.innerHTML = ''; 

        // Check if there are any documents
        if (snapshot.empty) {
            // If no documents, add a placeholder message
            liveTestimonialsContainer.innerHTML = '<p class="text-center w-full">No testimonials yet. Be the first to submit!</p>';
            return;
        }

        const cards = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            cards.push(data);
        });

        // Sort by timestamp (newest first).
        cards.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        // Display the cards
        cards.forEach(data => {
            liveTestimonialsContainer.appendChild(createTestimonialHTML(data));
        });

    }, (error) => {
        console.error("Error setting up real-time listener:", error);
        liveTestimonialsContainer.innerHTML = '<p class="text-center w-full" style="color:#dc3545;">Failed to load testimonials. Check console for details.</p>';
    });
}

// Initial call to start the auth process which triggers testimonial loading
if (auth && db) {
    authenticateUser();
}


