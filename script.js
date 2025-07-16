// Utility module for API calls
var APIModule = {
    baseUrl: 'https://api.threadcommunication.com',
    token: "unspecified_token!",

    init: function(options) {
        this.token = options.token;
        this.baseUrl = options.baseUrl || this.baseUrl;
    },

    post: async function(endpoint, data) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': this.token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            const responseData = await response.json();
            if (responseData.message) {
                console.warn(responseData.message);
            }
            console.log('Success:', responseData);
            return responseData;
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }
};

// Module for tracking user activity
var TrackingModule = {
    init: function() {
        this.setupEventListeners();
        this.handlePageVisit();
    },

    setupEventListeners: function() {
        window.addEventListener('beforeunload', this.transferSessionToLocalStorage.bind(this));
    },

    handlePageVisit: function() {
        this.handleEvent('pageview');
    },

    handleEvent: function (type) {
        try {
            var existingSessionData = JSON.parse(sessionStorage.getItem('sessionTrackingData')) || { sessionId: new Date().toISOString(), trackingParams: this.collectInitialPageVisitData(), events: {} };
            var timestamp = new Date().toISOString();
            existingSessionData.events[timestamp] = {
                type: type,
                date: timestamp,
            };
            sessionStorage.setItem('sessionTrackingData', JSON.stringify(existingSessionData));
        } catch (error) {
            console.error('Failed to handle event:', error);
        }
    },

    transferSessionToLocalStorage: function() {
        try {
            const sessionData = JSON.parse(sessionStorage.getItem('sessionTrackingData'))
            if (sessionData) {
                let existingLocalData = JSON.parse(localStorage.getItem('trackingHistory'))
                if (!existingLocalData || Array.isArray(existingLocalData)) {
                    existingLocalData = {}
                }
                existingLocalData[sessionData.sessionId] = this.createSessionEntry(sessionData);
                localStorage.setItem(
                    'trackingHistory',
                    JSON.stringify(existingLocalData)
                )
            }
            sessionStorage.removeItem('sessionTrackingData')
        }
        catch (error) {
            console.error('Failed to transfer session data:', error)
        }
    },

    createSessionEntry: function(sessionData) {
        return {
            sessionData: sessionData,
            sessionStart: sessionData.trackingParams.timestamp,
            sessionEnd: new Date().toISOString()
        };
    },

    collectInitialPageVisitData: function() {
        var url = document.referrer;
        var source = url ? new URL(url).hostname.split('.').slice(-2, -1)[0] : 'Direct or no-referrer';
        var isFirstVisit = !localStorage.getItem('hasVisitedBefore');
        var urlParams = new URLSearchParams(window.location.search);
        var timestamp = new Date().toISOString();
        if (isFirstVisit) localStorage.setItem('hasVisitedBefore', 'true');
        return {
            type: isFirstVisit ? 'initial_visit' : 'pageview',
            source: urlParams.get('utm_source') || 'N/A',
            medium: urlParams.get('utm_medium') || 'N/A',
            campaign: urlParams.get('utm_campaign') || 'N/A',
            term: urlParams.get('utm_term') || 'N/A',
            content: urlParams.get('utm_content') || 'N/A',
            referrerSource: source,
            timestamp: timestamp,
        };
    },

    getTrackingData: function() {
        const trackingHistory = JSON.parse(localStorage.getItem('trackingHistory') || '{}');
        const sessionHistory = JSON.parse(sessionStorage.getItem('sessionTrackingData'));
        if (sessionHistory) {
            trackingHistory[sessionHistory.sessionId] = this.createSessionEntry(sessionHistory);
        }
        return trackingHistory;
    }
};

// Module for handling telecom links (click-to-call, SMS)
// TODO: refactor to make this use the headers and use the practice instead of the website
var TelecomModule = {
    init: function() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.addEventListeners();
            });
        } else {
            this.addEventListeners();
        }
    },

    addEventListeners: function() {
        document.body.addEventListener('click', this.handleTelecomLinkClick.bind(this));
    },

    handleTelecomLinkClick: async function(e) {
        const link = e.target.closest('a');
        if (!link) { return; }
        const hrefType = link.href.startsWith('tel:') ? 'tel' : link.href.startsWith('sms:') ? 'sms' : null;
        if (!hrefType) { return; }
        
        const trackingHistory = TrackingModule.getTrackingData();
        const params = {
            phone: link.href.replace(/^tel:|^sms:/, ''),
            tracking_history: trackingHistory,
            href_type: hrefType,
            website: window.location.href
        };
        
        try {
            await APIModule.post('/api/v1/telecom_click', params);
        } catch (error) {
            console.error('Failed to log telecom click:', error);
        }
    }
};

// Module for form handling and submission
var FormModule = {
    init: function() {
        this.loadFuseJSAndSetupForms();
        this.setupMutationObserver();
    },

    loadFuseJSAndSetupForms: function() {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/fuse.js/dist/fuse.min.js';
        script.onload = () => this.setupFormHandling();
        document.head.appendChild(script);
    },

    setupMutationObserver: function() {
        const observer = new MutationObserver(this.debounce(this.setupFormHandling.bind(this), 300));
        observer.observe(document.body, { childList: true, subtree: true });
    },

    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    setupFormHandling: function() {
        document.querySelectorAll('form').forEach(form => {
            if (!form.hasAttribute('data-form-module-initialized')) {
                form.addEventListener('submit', this.handleFormSubmit.bind(this));
                form.setAttribute('data-form-module-initialized', 'true');
            }
        });
    },

    handleFormSubmit: function(event) {
        event.preventDefault();
        TrackingModule.handleEvent('form_submission');
        this.processAndSubmitForm(event.target);
    },

    processAndSubmitForm: async function(form) {
        const formData = this.getFormDataArray(form);
        const fuzzyMatcher = this.createFuzzyMatcher(formData);
        const leadData = this.extractLeadData(fuzzyMatcher);
        const trackingHistory = TrackingModule.getTrackingData();
        
        const params = { ...leadData, tracking_history: trackingHistory };

        try {
            await APIModule.post('/api/v1/website_leads', params);
        } catch (error) {
            console.error('New Lead not created in RG CRM.', error);
        }
    },

    getFormDataArray: function(form) {
        const formData = new FormData(form);
        return Array.from(formData.entries()).map(([key, value]) => {
            const field = form.querySelector(`[name="${key}"]`);
            // First try to find label with for attribute
            let label = field.id ? form.querySelector(`label[for="${field.id}"]`) : null;

            // If no label found, check if input is nested inside a label (common in Contact Form 7)
            if (!label) {
                label = field.closest('label');
            }

            let labelText = label ? label.textContent.trim() : '';
            if (!labelText && field.placeholder) {
                labelText = field.placeholder.trim();
            }
            labelText = labelText || key;
            labelText = this.cleanLabelText(labelText);
            return { key: labelText, value };
        });
    },

    cleanLabelText: function(text) {
        return text.replace(/[^a-zA-Z\s]/g, '')  // Remove non-alphabetic characters
                   .replace(/\s+/g, ' ')         // Normalize white spaces
                   .trim();                      // Trim leading/trailing spaces
    },

    createFuzzyMatcher: function(formDataArray) {
        const options = {
            includeScore: true,
            keys: ['key'],
            threshold: 0.4, // Adjust this value to fine-tune matching sensitivity
        };
        const fuse = new Fuse(formDataArray, options);

        return function(searchKey) {
            const results = fuse.search(searchKey);
            if (results.length === 0) return null;

            // Define keywords that are likely to be associated with phone numbers
            const phoneKeywords = ['phone', 'mobile', 'cell', 'telephone', 'contact', 'tel'];
            // Define keywords that are unlikely to be phone numbers
            const nonPhoneKeywords = ['recaptcha', 'captcha', 'token', 'response', 'email', 'name'];

            // Sort results based on keyword matching and Fuse.js score
            results.sort((a, b) => {
                const aKey = a.item.key.toLowerCase();
                const bKey = b.item.key.toLowerCase();

                const aIsPhone = phoneKeywords.some(keyword => aKey.includes(keyword));
                const bIsPhone = phoneKeywords.some(keyword => bKey.includes(keyword));
                const aIsNonPhone = nonPhoneKeywords.some(keyword => aKey.includes(keyword));
                const bIsNonPhone = nonPhoneKeywords.some(keyword => bKey.includes(keyword));

                if (aIsPhone && !bIsPhone) return -1;
                if (!aIsPhone && bIsPhone) return 1;
                if (aIsNonPhone && !bIsNonPhone) return 1;
                if (!aIsNonPhone && bIsNonPhone) return -1;

                return a.score - b.score;
            });

            return results[0].item.value;
        };
    },

    extractLeadData: function(getFuzzyData) {
        const fullName = getFuzzyData('Name') || getFuzzyData('Full Name');
        let firstName = getFuzzyData('First Name');
        let lastName = getFuzzyData('Last Name') || getFuzzyData('Last');

        if (fullName) {
            const nameParts = fullName.trim().split(/\s+/);
            firstName = firstName || nameParts[0];
            lastName = lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
        }

        const phoneFields = ['yourtel', 'Phone', 'Mobile', 'Cell', 'Telephone', 'Contact Number'];
        const phone = phoneFields.reduce((result, field) => result || getFuzzyData(field), null);

        return {
            first_name: firstName || '',
            last_name: lastName || '',
            email: getFuzzyData('Email'),
            phone: phone || ''
        };
    }
};

// Main CRM object
var CRM = {
    init: function(config) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeModules(config);
            });
        } else {
            this.initializeModules(config);
        }
    },

    initializeModules: function(config) {
        APIModule.init(config);
        TrackingModule.init();
        TelecomModule.init();
        FormModule.init();
        console.log('CRM modules initialized');
    }
};

// Make TrackingModule globally accessible
window.TrackingModule = TrackingModule;

// Conditional export for testing environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { APIModule, TrackingModule, TelecomModule, FormModule, CRM };
}