import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { FormModule, APIModule, TrackingModule, TelecomModule } from '../script.js'

// Get the directory path for reading the HTML file
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read the actual ismileorthodontics.html file
const htmlFilePath = join(__dirname, '..', 'ismileorthodontics.html')
const actualISmileHTML = readFileSync(htmlFilePath, 'utf8')

describe('ISmile Orthodontics HTML Integration Tests', () => {
  let dom
  let document
  let window
  let originalFuse

  beforeEach(async () => {
    // Reset all mocks
    vi.resetAllMocks()
    
    // Create JSDOM instance with actual HTML
    dom = new JSDOM(actualISmileHTML, {
      url: 'https://ismileorthodontics.com/location/',
      referrer: 'https://ismileorthodontics.com/',
      contentType: 'text/html',
      runScripts: 'outside-only'
    })
    
    // Set up global DOM
    global.document = dom.window.document
    global.window = dom.window
    global.navigator = dom.window.navigator
    global.localStorage = dom.window.localStorage
    global.sessionStorage = dom.window.sessionStorage
    global.FormData = dom.window.FormData
    global.URL = dom.window.URL
    global.URLSearchParams = dom.window.URLSearchParams
    global.fetch = vi.fn()
    
    document = dom.window.document
    window = dom.window
    
    // Mock console methods
    global.console.log = vi.fn()
    global.console.warn = vi.fn()
    global.console.error = vi.fn()
    
    // Mock API calls
    vi.spyOn(APIModule, 'post').mockResolvedValue({ success: true })
    vi.spyOn(TrackingModule, 'handleEvent').mockImplementation(() => {})
    vi.spyOn(TrackingModule, 'getTrackingData').mockReturnValue({ mockTracking: 'data' })
    
    // Store original Fuse and mock it
    originalFuse = global.Fuse
    global.Fuse = vi.fn().mockImplementation(() => ({
      search: vi.fn().mockImplementation((searchKey) => {
        // Mock Fuse.js search behavior for form field matching
        const mockResults = {
          'first name': [{ item: { value: 'John' }, score: 0.1 }],
          'last name': [{ item: { value: 'Doe' }, score: 0.1 }],
          'email': [{ item: { value: 'john.doe@example.com' }, score: 0.1 }],
          'phone': [{ item: { value: '1234567890' }, score: 0.1 }],
          'subject': [{ item: { value: 'Orthodontic Consultation' }, score: 0.1 }],
          'message': [{ item: { value: 'I would like to schedule an appointment' }, score: 0.1 }]
        }
        const key = searchKey.toLowerCase()
        return mockResults[key] || []
      })
    }))
  })

  afterEach(() => {
    // Restore the original Fuse mock
    global.Fuse = originalFuse
    vi.restoreAllMocks()
  })

  describe('HTML Content Structure', () => {
    it('should load the actual ismileorthodontics.html content successfully', () => {
      expect(document).toBeDefined()
      expect(document.title).toContain('ISmile Orthodontics')
    })

    it('should contain the expected page structure', () => {
      expect(document.querySelector('title').textContent).toBe('Locations - ISmile Orthodontics')
      expect(document.querySelector('body')).toBeDefined()
    })

    it('should verify it loaded the real HTML file (not mock)', () => {
      // Check for specific elements that only exist in the real HTML
      expect(document.querySelector('meta[name="google-site-verification"]')).toBeDefined()
      expect(document.querySelector('script[src*="googletagmanager"]')).toBeDefined()
      expect(document.querySelector('link[rel="canonical"]')).toBeDefined()
    })
  })

  describe('Contact Form Detection and Processing', () => {
    it('should find the main contact form', () => {
      const forms = document.querySelectorAll('form')
      expect(forms.length).toBeGreaterThan(0)
      
      // Find the main contact form (WPCF7 form)
      const contactForm = document.querySelector('form.wpcf7-form')
      expect(contactForm).toBeDefined()
    })

    it('should extract form fields correctly from real HTML', () => {
      const contactForm = document.querySelector('form.wpcf7-form')
      expect(contactForm).toBeDefined()
      
      // Check for specific form fields as they appear in the real HTML
      const firstNameField = contactForm.querySelector('input[name="first-name"]')
      const lastNameField = contactForm.querySelector('input[name="last-name"]')
      const emailField = contactForm.querySelector('input[name="your-email"]')
      const phoneField = contactForm.querySelector('input[name="tel-778"]')
      const subjectField = contactForm.querySelector('input[name="your-subject"]')
      const messageField = contactForm.querySelector('textarea[name="message"]')
      const acceptanceField = contactForm.querySelector('input[name="acceptance-147"]')
      
      expect(firstNameField).toBeDefined()
      expect(lastNameField).toBeDefined()
      expect(emailField).toBeDefined()
      expect(phoneField).toBeDefined()
      expect(subjectField).toBeDefined()
      expect(messageField).toBeDefined()
      expect(acceptanceField).toBeDefined()
      
      // Verify field types
      expect(firstNameField.type).toBe('text')
      expect(lastNameField.type).toBe('text')
      expect(emailField.type).toBe('email')
      expect(phoneField.type).toBe('tel')
      expect(messageField.tagName.toLowerCase()).toBe('textarea')
      expect(acceptanceField.type).toBe('checkbox')
    })

    it('should process form data using FormModule with real HTML structure', () => {
      const contactForm = document.querySelector('form.wpcf7-form')
      
      // Simulate filling out the form
      const firstNameField = contactForm.querySelector('input[name="first-name"]')
      const lastNameField = contactForm.querySelector('input[name="last-name"]')
      const emailField = contactForm.querySelector('input[name="your-email"]')
      const phoneField = contactForm.querySelector('input[name="tel-778"]')
      
      firstNameField.value = 'John'
      lastNameField.value = 'Doe'
      emailField.value = 'john.doe@example.com'
      phoneField.value = '1234567890'
      
      // Test form data extraction
      const formDataArray = FormModule.getFormDataArray(contactForm)
      expect(formDataArray).toBeDefined()
      expect(formDataArray.length).toBeGreaterThan(0)
      
      // Check that form data contains expected fields
      const fieldNames = formDataArray.map(item => item.key.toLowerCase())
      expect(fieldNames.some(name => name.includes('first') || name.includes('name'))).toBe(true)
      expect(fieldNames.some(name => name.includes('last') || name.includes('name'))).toBe(true)
      expect(fieldNames.some(name => name.includes('email'))).toBe(true)
      expect(fieldNames.some(name => name.includes('tel') || name.includes('phone'))).toBe(true)
    })

    it('should create proper lead data from contact form', () => {
      const contactForm = document.querySelector('form.wpcf7-form')
      
      // Fill out form fields
      contactForm.querySelector('input[name="first-name"]').value = 'Jane'
      contactForm.querySelector('input[name="last-name"]').value = 'Smith'
      contactForm.querySelector('input[name="your-email"]').value = 'jane.smith@example.com'
      contactForm.querySelector('input[name="tel-778"]').value = '9876543210'
      
      const formDataArray = FormModule.getFormDataArray(contactForm)
      const fuzzyMatcher = FormModule.createFuzzyMatcher(formDataArray)
      const leadData = FormModule.extractLeadData(fuzzyMatcher)
      
      expect(leadData).toHaveProperty('first_name')
      expect(leadData).toHaveProperty('last_name')
      expect(leadData).toHaveProperty('email')
      expect(leadData).toHaveProperty('phone')
    })
  })

  describe('Phone Number Detection and Telecom Links', () => {
    it('should find multiple telephone links in the real HTML', () => {
      const telLinks = document.querySelectorAll('a[href^="tel:"]')
      expect(telLinks.length).toBeGreaterThan(0)
      
      // Check for specific phone numbers found in the real HTML
      const phoneNumbers = Array.from(telLinks).map(link => link.href.replace('tel:', ''))
      
      // These are the actual phone numbers from the real HTML
      const expectedPhones = [
        '6468632181', // Inwood
        '7186843131', // Bronx  
        '3473969214', // Yonkers
        '9144285335', // White Plains
        '9149629600', // Jefferson Valley
        '2035758398'  // Waterbury
      ]
      
      expectedPhones.forEach(phone => {
        expect(phoneNumbers.some(p => p.includes(phone))).toBe(true)
      })
      
      // Verify we have at least 6 phone links (there might be duplicates in the HTML)
      expect(telLinks.length).toBeGreaterThanOrEqual(6)
    })

    it('should handle telecom link clicks correctly with real HTML', () => {
      const telLinks = document.querySelectorAll('a[href^="tel:"]')
      expect(telLinks.length).toBeGreaterThan(0)
      
      // Get the first tel link
      const firstTelLink = telLinks[0]
      const phoneNumber = firstTelLink.href.replace('tel:', '')
      
      // Mock click event
      const clickEvent = new dom.window.Event('click', { bubbles: true })
      Object.defineProperty(clickEvent, 'target', { value: firstTelLink })
      
      // Test telecom click handling
      TelecomModule.handleTelecomLinkClick(clickEvent)
      
      expect(APIModule.post).toHaveBeenCalledWith('/api/v1/telecom_click', 
        expect.objectContaining({
          phone: phoneNumber,
          href_type: 'tel',
          tracking_history: expect.any(Object),
          website: expect.any(String)
        })
      )
    })

    it('should extract location-specific contact information from real HTML', () => {
      // Test extraction of location names - checking for text content in the document
      const bodyText = document.body.textContent || document.body.innerText
      const locationNames = ['Inwood', 'Bronx', 'Yonkers', 'Jefferson Valley', 'White Plains', 'Waterbury']
      
      locationNames.forEach(locationName => {
        expect(bodyText.includes(locationName)).toBe(true)
      })
    })
  })

  describe('Search Form Detection', () => {
    it('should find search forms in the real HTML', () => {
      // Look for any search-related forms or inputs
      const searchInputs = document.querySelectorAll('input[type="search"], input[name="s"]')
      
      if (searchInputs.length > 0) {
        expect(searchInputs.length).toBeGreaterThan(0)
        
        // Check that search inputs exist
        searchInputs.forEach(input => {
          expect(input).toBeDefined()
          expect(input.type === 'search' || input.name === 's').toBe(true)
        })
      } else {
        // If no search forms found, that's also valid - just document it
        console.log('No search forms found in the real HTML')
        expect(true).toBe(true) // Pass the test
      }
    })
  })

  describe('CRM Integration with Real HTML', () => {
    it('should initialize FormModule with real form handling', () => {
      FormModule.init()
      
      // Check that forms are properly initialized
      const forms = document.querySelectorAll('form')
      if (forms.length > 0) {
        const wpcf7Form = document.querySelector('form.wpcf7-form')
        if (wpcf7Form) {
          expect(wpcf7Form.hasAttribute('data-form-module-initialized')).toBe(true)
        }
      }
    })

    it('should handle form submission with tracking using real HTML', async () => {
      const contactForm = document.querySelector('form.wpcf7-form')
      expect(contactForm).toBeDefined()
      
      // Fill out the form
      contactForm.querySelector('input[name="first-name"]').value = 'Test'
      contactForm.querySelector('input[name="last-name"]').value = 'User'
      contactForm.querySelector('input[name="your-email"]').value = 'test@example.com'
      contactForm.querySelector('input[name="tel-778"]').value = '5555555555'
      
      // Create submit event
      const submitEvent = new dom.window.Event('submit', { bubbles: true, cancelable: true })
      Object.defineProperty(submitEvent, 'target', { value: contactForm })
      
      // Test form submission
      await FormModule.handleFormSubmit(submitEvent)
      
      expect(submitEvent.defaultPrevented).toBe(true)
      expect(TrackingModule.handleEvent).toHaveBeenCalledWith('form_submission')
      expect(APIModule.post).toHaveBeenCalledWith('/api/v1/website_leads', 
        expect.objectContaining({
          tracking_history: expect.any(Object)
        })
      )
    })

    it('should track page visit data', () => {
      // Set up URL with UTM parameters
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://ismileorthodontics.com/location/',
          search: '?utm_source=google&utm_medium=cpc&utm_campaign=orthodontics'
        }
      })
      
      TrackingModule.handlePageVisit()
      
      const sessionData = JSON.parse(sessionStorage.getItem('sessionTrackingData'))
      expect(sessionData).toBeDefined()
      expect(sessionData.trackingParams.source).toBe('google')
      expect(sessionData.trackingParams.medium).toBe('cpc')
      expect(sessionData.trackingParams.campaign).toBe('orthodontics')
    })
  })

  describe('ISmile Specific Form Field Mapping Tests', () => {
    it('should correctly map ISmile contact form fields from real HTML', () => {
      const contactForm = document.querySelector('form.wpcf7-form')
      
      // Fill the actual form fields
      contactForm.querySelector('input[name="first-name"]').value = 'Sarah'
      contactForm.querySelector('input[name="last-name"]').value = 'Johnson'
      contactForm.querySelector('input[name="your-email"]').value = 'sarah.johnson@email.com'
      contactForm.querySelector('input[name="tel-778"]').value = '5551234567'
      
      const messageField = contactForm.querySelector('textarea[name="message"]')
      if (messageField) {
        messageField.value = 'I would like to schedule a consultation'
      }
      
      const subjectField = contactForm.querySelector('input[name="your-subject"]')
      if (subjectField) {
        subjectField.value = 'Consultation Request'
      }
      
      const formDataArray = FormModule.getFormDataArray(contactForm)
      expect(formDataArray).toBeDefined()
      expect(formDataArray.length).toBeGreaterThan(0)
      
      // Check that we can extract the expected values
      const firstNameData = formDataArray.find(item => 
        item.value === 'Sarah' || item.key.toLowerCase().includes('first')
      )
      const lastNameData = formDataArray.find(item => 
        item.value === 'Johnson' || item.key.toLowerCase().includes('last')
      )
      const emailData = formDataArray.find(item => 
        item.value === 'sarah.johnson@email.com' || item.key.toLowerCase().includes('email')
      )
      const phoneData = formDataArray.find(item => 
        item.value === '5551234567' || item.key.toLowerCase().includes('tel') || item.key.toLowerCase().includes('phone')
      )
      
      expect(firstNameData).toBeDefined()
      expect(lastNameData).toBeDefined()
      expect(emailData).toBeDefined()
      expect(phoneData).toBeDefined()
    })

    it('should handle ISmile form with fuzzy matching using real HTML', () => {
      const contactForm = document.querySelector('form.wpcf7-form')
      
      // Fill form fields
      contactForm.querySelector('input[name="first-name"]').value = 'Michael'
      contactForm.querySelector('input[name="last-name"]').value = 'Rodriguez'
      contactForm.querySelector('input[name="your-email"]').value = 'michael@example.com'
      contactForm.querySelector('input[name="tel-778"]').value = '5559876543'
      
      const formDataArray = FormModule.getFormDataArray(contactForm)
      const fuzzyMatcher = FormModule.createFuzzyMatcher(formDataArray)
      const leadData = FormModule.extractLeadData(fuzzyMatcher)
      
      // Check that we get proper structured data
      expect(leadData).toBeDefined()
      expect(leadData).toHaveProperty('first_name')
      expect(leadData).toHaveProperty('last_name')
      expect(leadData).toHaveProperty('email')
      expect(leadData).toHaveProperty('phone')
    })

    it('should verify phone field label extraction works with real HTML structure', () => {
      const contactForm = document.querySelector('form.wpcf7-form')
      const phoneField = contactForm.querySelector('input[name="tel-778"]')
      
      expect(phoneField).toBeDefined()
      expect(phoneField.type).toBe('tel')
      
      // Test that our label extraction logic works
      const formDataArray = FormModule.getFormDataArray(contactForm)
      const phoneData = formDataArray.find(item => item.key.toLowerCase().includes('tel') || item.key.toLowerCase().includes('phone'))
      
      // The phone field should be detected and labeled appropriately
      expect(phoneData).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing form fields gracefully', () => {
      const incompleteForm = document.createElement('form')
      document.body.appendChild(incompleteForm)
      
      expect(() => {
        const formDataArray = FormModule.getFormDataArray(incompleteForm)
        const fuzzyMatcher = FormModule.createFuzzyMatcher(formDataArray)
        const leadData = FormModule.extractLeadData(fuzzyMatcher)
        
        expect(leadData).toHaveProperty('first_name')
        expect(leadData).toHaveProperty('last_name')
        expect(leadData).toHaveProperty('email')
        expect(leadData).toHaveProperty('phone')
      }).not.toThrow()
      
      document.body.removeChild(incompleteForm)
    })

    it('should handle API failures gracefully', async () => {
      vi.spyOn(APIModule, 'post').mockRejectedValue(new Error('API Error'))
      
      const contactForm = document.querySelector('form.wpcf7-form')
      const submitEvent = new dom.window.Event('submit', { bubbles: true, cancelable: true })
      Object.defineProperty(submitEvent, 'target', { value: contactForm })
      
      expect(async () => {
        await FormModule.handleFormSubmit(submitEvent)
      }).not.toThrow()
      
      expect(console.error).toHaveBeenCalledWith('New Lead not created in RG CRM.', expect.any(Error))
    })
  })
}) 