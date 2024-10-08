import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TrackingModule } from '../script.js'

describe('TrackingModule', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })
  
  it('TrackingModule should handle a page visit', () => {
    TrackingModule.handlePageVisit()
    const sessionStorageData = JSON.parse(sessionStorage.getItem('sessionTrackingData'))
    expect(sessionStorageData).toBeDefined()
    expect(sessionStorageData.events).toBeDefined()
  })

  it('transferSessionToLocalStorage should transfer session to local storage', () => {
    TrackingModule.handlePageVisit()
    TrackingModule.transferSessionToLocalStorage()
    const sessionStorageData = JSON.parse(sessionStorage.getItem('sessionTrackingData'))
    const trackingHistory = JSON.parse(localStorage.getItem('trackingHistory'))

    expect(sessionStorageData).toBeNull()
    expect(Object.keys(trackingHistory)).toHaveLength(1)
    
    const sessionKey = Object.keys(trackingHistory)[0]
    const trackingHistorySessionInstance = trackingHistory[sessionKey]
    
    expect(trackingHistorySessionInstance).toHaveProperty('sessionData')
    expect(trackingHistorySessionInstance).toHaveProperty('sessionStart')
    expect(trackingHistorySessionInstance).toHaveProperty('sessionEnd')
    
    expect(trackingHistorySessionInstance.sessionData).toHaveProperty('sessionId')
    expect(trackingHistorySessionInstance.sessionData).toHaveProperty('trackingParams')
    expect(trackingHistorySessionInstance.sessionData).toHaveProperty('events')
    
    expect(trackingHistorySessionInstance.sessionStart).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(trackingHistorySessionInstance.sessionEnd).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('getTrackingData should return correctly structured data from local storage and session storage', async () => {
    TrackingModule.handlePageVisit()
    TrackingModule.transferSessionToLocalStorage()
    // Wait to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 1))
    TrackingModule.handlePageVisit()

    const trackingData = TrackingModule.getTrackingData()

    expect(Object.keys(trackingData)).toHaveLength(2)

    const [localStorageSession, sessionStorageSession] = Object.values(trackingData)

    // Function to check session structure
    const checkSessionStructure = (session) => {
      expect(session).toHaveProperty('sessionData')
      expect(session).toHaveProperty('sessionStart')
      expect(session).toHaveProperty('sessionEnd')
      expect(session.sessionData).toHaveProperty('sessionId')
      expect(session.sessionData).toHaveProperty('trackingParams')
      expect(session.sessionData).toHaveProperty('events')
      expect(session.sessionStart).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      expect(session.sessionEnd).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    }

    // Check structure for both sessions
    checkSessionStructure(localStorageSession)
    checkSessionStructure(sessionStorageSession)

    // Compare structures
    expect(Object.keys(localStorageSession)).toEqual(Object.keys(sessionStorageSession))
    expect(Object.keys(localStorageSession.sessionData)).toEqual(Object.keys(sessionStorageSession.sessionData))
  })

  it('should correctly set up beforeunload event listeners', () => {
    vi.spyOn(window, 'addEventListener')
    TrackingModule.init()
    expect(window.addEventListener).toHaveBeenCalledWith(
      'beforeunload',
       expect.any(Function)
    )
  })

  it('should handle different types of events', () => {
    vi.spyOn(TrackingModule, 'handleEvent')
    TrackingModule.handleEvent('click')
    expect(TrackingModule.handleEvent).toHaveBeenCalledWith('click')
    const sessionData = JSON.parse(sessionStorage.getItem('sessionTrackingData'))
    
    const eventKeys = Object.keys(sessionData.events)
    expect(eventKeys).toHaveLength(1)
    const eventKey = eventKeys[0]
    const eventData = sessionData.events[eventKey]
    expect(eventData.type).toBe('click')
  })

  it('should collect initial page visit data correctly', () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?utm_source=test1&utm_medium=test2&utm_campaign=test3&utm_content=test4&utm_term=test5'
      }
    });
    TrackingModule.handlePageVisit();
    const sessionDataString = sessionStorage.getItem('sessionTrackingData');
    const sessionData = JSON.parse(sessionDataString);

    expect(sessionData.trackingParams.source).toBe('test1');
    expect(sessionData.trackingParams.medium).toBe('test2');
    expect(sessionData.trackingParams.campaign).toBe('test3');
    expect(sessionData.trackingParams.content).toBe('test4');
    expect(sessionData.trackingParams.term).toBe('test5');
  })

  it('should collect partial UTM parameters correctly', () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?utm_campaign=21131269577&utm_source=google_ads'
      }
    });
    TrackingModule.handlePageVisit();
    const sessionDataString = sessionStorage.getItem('sessionTrackingData');
    const sessionData = JSON.parse(sessionDataString);

    expect(sessionData.trackingParams.campaign).toBe('21131269577');
    expect(sessionData.trackingParams.source).toBe('google_ads');
  })
})