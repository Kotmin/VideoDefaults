/** @returns {{ manualOverride: boolean, extensionToken: string|null }} */
export function createState() {
  return { manualOverride: false, extensionToken: null };
}

/** @param {object} state @param {string} token @returns {object} */
export function markExtensionWrite(state, token) {
  return { ...state, extensionToken: token };
}

/** @param {object} state @returns {object} */
export function markManualOverride(state) {
  return { ...state, manualOverride: true };
}

/** @param {object} state @returns {object} */
export function clearOverride(state) {
  return createState();
}

/** @param {object} state @returns {object} */
export function clearExtensionToken(state) {
  return { ...state, extensionToken: null };
}

/** @param {object} state @returns {boolean} */
export function isManualOverride(state) {
  return state.manualOverride === true;
}

/** @param {object} state @param {string} token @returns {boolean} */
export function isExtensionToken(state, token) {
  return state.extensionToken === token;
}
