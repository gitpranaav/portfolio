document.addEventListener('DOMContentLoaded', () => {
    // Mobile Menu Toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const navLinksItems = document.querySelectorAll('.nav-links a');

    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        hamburger.innerHTML = navLinks.classList.contains('active') 
            ? '<i class="fas fa-times"></i>' 
            : '<i class="fas fa-bars"></i>';
    });

    // Close mobile menu on link click
    navLinksItems.forEach(item => {
        item.addEventListener('click', () => {
            if (navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                hamburger.innerHTML = '<i class="fas fa-bars"></i>';
            }
        });
    });

    // Navbar Scroll Effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Typing Effect
    const typingText = document.querySelector('.typing-text');
    const phrases = [
        "Software Developer",
        "IT Undergraduate",
        "Problem Solver",
        "Tech Enthusiast"
    ];
    let phraseIndex = 0;
    let letterIndex = 0;
    let isDeleting = false;
    let typingSpeed = 100;

    function type() {
        const currentPhrase = phrases[phraseIndex];
        
        if (isDeleting) {
            typingText.textContent = currentPhrase.substring(0, letterIndex - 1);
            letterIndex--;
            typingSpeed = 50;
        } else {
            typingText.textContent = currentPhrase.substring(0, letterIndex + 1);
            letterIndex++;
            typingSpeed = 100;
        }

        if (!isDeleting && letterIndex === currentPhrase.length) {
            isDeleting = true;
            typingSpeed = 2000; // Pause at end of phrase
        } else if (isDeleting && letterIndex === 0) {
            isDeleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            typingSpeed = 500; // Pause before new phrase
        }

        setTimeout(type, typingSpeed);
    }

    // Start typing effect after short delay
    setTimeout(type, 1000);

    // LeetCode Activity Map Logic
    const leetcodeMap = document.getElementById('leetcode-map');
    const revealBtn = document.getElementById('reveal-map-btn');
    const activityGrid = document.getElementById('activity-grid');

    if (revealBtn && leetcodeMap) {
        revealBtn.addEventListener('click', () => {
            leetcodeMap.classList.remove('collapsed');
        });
    }

    async function fetchLeetcodeData() {
        if (!activityGrid) return;
        try {
            const response = await fetch('https://alfa-leetcode-api.onrender.com/pranav-navandar/calendar');
            const data = await response.json();
            if (data.submissionCalendar) {
                const calendar = JSON.parse(data.submissionCalendar);
                renderActivityMap(calendar);
            }
        } catch (error) {
            console.error('Error fetching LeetCode data:', error);
            activityGrid.innerHTML = '<p style="color: var(--text-secondary); padding: 1rem;">Failed to load activity map.</p>';
        }
    }

    function renderActivityMap(calendarData) {
        // Calculate the last 365 days
        const today = new Date();
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        
        // Find the next Sunday from one year ago to align columns properly
        while (oneYearAgo.getDay() !== 0) {
            oneYearAgo.setDate(oneYearAgo.getDate() + 1);
        }

        const days = [];
        let current = new Date(oneYearAgo);
        
        while (current <= today) {
            days.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }

        activityGrid.innerHTML = '';

        days.forEach(day => {
            // Convert to unix timestamp string at midnight UTC roughly matching LeetCode format
            const timestampStart = Math.floor(new Date(day.setHours(0,0,0,0)).getTime() / 1000);
            const timestampEnd = timestampStart + 86400;
            
            let submissions = 0;
            // Search calendar for matching day
            for (const [ts, count] of Object.entries(calendarData)) {
                if (ts >= timestampStart && ts < timestampEnd) {
                    submissions += count;
                }
            }

            const box = document.createElement('div');
            box.classList.add('activity-box');
            
            // Add tooltip as native title
            const dateStr = day.toLocaleDateString();
            box.title = `${submissions} submissions on ${dateStr}`;

            if (submissions > 0 && submissions <= 2) box.classList.add('level-1');
            else if (submissions > 2 && submissions <= 5) box.classList.add('level-2');
            else if (submissions > 5 && submissions <= 8) box.classList.add('level-3');
            else if (submissions > 8) box.classList.add('level-4');
            else box.classList.add('level-0');

            activityGrid.appendChild(box);
        });

        // Scroll to the end (most recent)
        const scrollWrapper = document.querySelector('.map-scroll-wrapper');
        if (scrollWrapper) {
            scrollWrapper.scrollLeft = scrollWrapper.scrollWidth;
        }
    }

    fetchLeetcodeData();
});
