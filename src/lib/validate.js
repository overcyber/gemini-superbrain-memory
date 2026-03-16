const CONTROL_CHARACTERS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const BYTE_ORDER_MARK = /\uFEFF/g;
const UNICODE_SPECIALS = /[\uFFF0-\uFFFF]/g;

const DEFAULT_MAX_LENGTH = 100_000;

// SanitzeContent removes control characters, byte order marks and unicode specials from the content
export function SanitizeContent(content , maxLength = DEFAULT_MAX_LENGTH) {
    if(!content || typeof content !== 'string') return '';

    let sanitized = content ;

    sanitized = sanitized.replace(CONTROL_CHARACTERS, '');
    sanitized = sanitized.replace(BYTE_ORDER_MARK, '');
    sanitized = sanitized.replace(UNICODE_SPECIALS, '');

    if(sanitized.length > maxLength){
        sanitized = sanitized.slice(0, maxLength);
    }
    return sanitized;
}

// ValidateContentLength checks if the content length is within the specified min and max length limits
export function ValidateContentLength(content, min = 1 ,maxLength = DEFAULT_MAX_LENGTH) {
   if(content.length < min) {
    return {valid: false, reason: `Content is below the minimum length of ${min} characters`}
   }
   if(content.length > maxLength) {
    return {valid: false, reason: `Content exceeds the maximum length of ${maxLength} characters`}
   }
   return {valid: true, reason: null}
}

// ValidateApiKey checks if the API key is a non-empty string that starts with "sm_" and does not contain whitespace
export function ValidateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== "string") {
    return { valid: false, reason: "API key is missing or not a string" };
  }
  if (!apiKey.startsWith("sm_")) {
    return { valid: false, reason: "API key must start with 'sm_' prefix" };
  }
  if (apiKey.length < 20) {
    return { valid: false, reason: "API key is too short to be valid" };
  }
  if (/\s/.test(apiKey)) {
    return { valid: false, reason: "API key must not contain whitespace" };
  }
  return { valid: true };
}

// validateContainerTag checks if the container tag is a non-empty string that is 100 characters or fewer, contains only letters, numbers, hyphens and underscores, and does not start or end with a hyphen or underscore
export function validateContainerTag(tag) {
  if (!tag || typeof tag !== "string") {
    return { valid: false, reason: "Container tag is missing or not a string" };
  }
  if (tag.length > 100) {
    return { valid: false, reason: "Container tag must be 100 characters or fewer" };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
    return {
      valid: false,
      reason: "Container tag may only contain letters, numbers, hyphens, and underscores",
    };
  }
  if (/^[-_]|[-_]$/.test(tag)) {
    return {
      valid: false,
      reason: "Container tag must not start or end with a hyphen or underscore",
    };
  }
  return { valid: true };
}