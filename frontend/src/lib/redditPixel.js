/**
 * Reddit Pixel Tracking Utility
 * 
 * Standard Events:
 * - PageVisit: Automatically tracked on page load
 * - ViewContent: User views specific content
 * - Search: User performs a search
 * - AddToCart: User adds item to cart
 * - AddToWishlist: User adds item to wishlist
 * - Purchase: User completes a purchase
 * - Lead: User submits a lead form
 * - SignUp: User signs up
 * - Custom: Custom event with your own name
 */

// Check if Reddit Pixel is loaded
const isRedditPixelLoaded = () => {
  return typeof window !== 'undefined' && typeof window.rdt === 'function';
};

/**
 * Track a standard Reddit event
 * @param {string} eventName - The event name (e.g., 'Lead', 'SignUp', 'Purchase')
 * @param {object} eventData - Optional event data
 */
export const trackRedditEvent = (eventName, eventData = {}) => {
  if (!isRedditPixelLoaded()) {
    console.warn('Reddit Pixel not loaded');
    return;
  }

  try {
    if (Object.keys(eventData).length > 0) {
      window.rdt('track', eventName, eventData);
    } else {
      window.rdt('track', eventName);
    }
    console.log(`Reddit Pixel: Tracked ${eventName}`, eventData);
  } catch (error) {
    console.error('Reddit Pixel tracking error:', error);
  }
};

/**
 * Track a custom event
 * @param {string} customEventName - Your custom event name
 * @param {object} eventData - Optional event data
 */
export const trackRedditCustomEvent = (customEventName, eventData = {}) => {
  if (!isRedditPixelLoaded()) {
    console.warn('Reddit Pixel not loaded');
    return;
  }

  try {
    window.rdt('track', 'Custom', { customEventName, ...eventData });
    console.log(`Reddit Pixel: Tracked Custom Event - ${customEventName}`, eventData);
  } catch (error) {
    console.error('Reddit Pixel custom event tracking error:', error);
  }
};

// Pre-defined tracking functions for common events

/**
 * Track diagnostic completion
 * @param {number} score - The diagnostic score
 * @param {string} recommendation - The recommendation category
 */
export const trackDiagnosticComplete = (score, recommendation) => {
  trackRedditCustomEvent('DiagnosticComplete', {
    score,
    recommendation,
  });
};

/**
 * Track when a user asks a question in community Q&A
 * @param {string} questionId - The question ID
 */
export const trackQuestionAsked = (questionId) => {
  trackRedditEvent('Lead', {
    lead_type: 'community_question',
  });
  trackRedditCustomEvent('QuestionAsked', { questionId });
};

/**
 * Track when a user posts an answer in community Q&A
 * @param {string} questionId - The question ID
 */
export const trackAnswerPosted = (questionId) => {
  trackRedditCustomEvent('AnswerPosted', { questionId });
};

/**
 * Track page view (for SPA navigation)
 */
export const trackPageView = () => {
  trackRedditEvent('PageVisit');
};

/**
 * Track content view
 * @param {string} contentType - Type of content (e.g., 'blog', 'service', 'case_study')
 * @param {string} contentId - Content identifier
 */
export const trackViewContent = (contentType, contentId) => {
  trackRedditEvent('ViewContent', {
    content_type: contentType,
    content_id: contentId,
  });
};

/**
 * Track lead/form submission
 * @param {string} formType - Type of form (e.g., 'contact', 'intake')
 */
export const trackLead = (formType) => {
  trackRedditEvent('Lead', {
    lead_type: formType,
  });
};

/**
 * Track purchase/payment
 * @param {number} value - Purchase value
 * @param {string} currency - Currency code (default: USD)
 */
export const trackPurchase = (value, currency = 'USD') => {
  trackRedditEvent('Purchase', {
    value,
    currency,
  });
};

export default {
  trackRedditEvent,
  trackRedditCustomEvent,
  trackDiagnosticComplete,
  trackQuestionAsked,
  trackAnswerPosted,
  trackPageView,
  trackViewContent,
  trackLead,
  trackPurchase,
};
