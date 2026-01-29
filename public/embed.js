/**
 * ActionChat Embed Widget Loader
 *
 * Usage:
 * <script src="https://your-actionchat.com/embed.js" data-token="YOUR_EMBED_TOKEN"></script>
 *
 * Optional attributes:
 * - data-position: "bottom-right" (default), "bottom-left"
 * - data-button-color: Hex color for the launcher button (default: "#3b82f6")
 * - data-button-size: Button size in pixels (default: 56)
 * - data-open: "true" to start with widget open
 */
(function() {
  'use strict';

  // Find the script tag to get config
  const scripts = document.getElementsByTagName('script');
  let config = null;

  for (let i = scripts.length - 1; i >= 0; i--) {
    const script = scripts[i];
    if (script.src && script.src.includes('embed.js') && script.dataset.token) {
      config = {
        token: script.dataset.token,
        position: script.dataset.position || 'bottom-right',
        buttonColor: script.dataset.buttonColor || '#3b82f6',
        buttonSize: parseInt(script.dataset.buttonSize, 10) || 56,
        startOpen: script.dataset.open === 'true',
        baseUrl: script.src.replace(/\/embed\.js.*$/, ''),
      };
      break;
    }
  }

  if (!config || !config.token) {
    console.error('[ActionChat] Missing data-token attribute on embed script');
    return;
  }

  // State
  let isOpen = config.startOpen;
  let container, button, iframe, closeBtn;

  // Create styles
  const styles = document.createElement('style');
  styles.textContent = `
    .actionchat-container {
      position: fixed;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .actionchat-container.bottom-right {
      bottom: 20px;
      right: 20px;
    }
    .actionchat-container.bottom-left {
      bottom: 20px;
      left: 20px;
    }
    .actionchat-button {
      width: ${config.buttonSize}px;
      height: ${config.buttonSize}px;
      border-radius: 50%;
      background: ${config.buttonColor};
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .actionchat-button:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }
    .actionchat-button svg {
      width: 28px;
      height: 28px;
      fill: white;
    }
    .actionchat-iframe-container {
      position: absolute;
      bottom: ${config.buttonSize + 16}px;
      width: 380px;
      height: 560px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
      opacity: 0;
      transform: translateY(10px) scale(0.95);
      transition: opacity 0.2s, transform 0.2s;
      pointer-events: none;
      background: #0a0a0f;
    }
    .actionchat-container.bottom-right .actionchat-iframe-container {
      right: 0;
    }
    .actionchat-container.bottom-left .actionchat-iframe-container {
      left: 0;
    }
    .actionchat-iframe-container.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    .actionchat-iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    .actionchat-close {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1;
      transition: background 0.2s;
    }
    .actionchat-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    .actionchat-close svg {
      width: 14px;
      height: 14px;
      stroke: white;
      stroke-width: 2;
    }
    @media (max-width: 480px) {
      .actionchat-iframe-container {
        width: calc(100vw - 40px);
        height: calc(100vh - 120px);
        bottom: ${config.buttonSize + 16}px;
      }
      .actionchat-container.bottom-right .actionchat-iframe-container,
      .actionchat-container.bottom-left .actionchat-iframe-container {
        right: 0;
        left: 0;
        margin: 0 auto;
      }
    }
  `;
  document.head.appendChild(styles);

  // Chat icon SVG
  const chatIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`;

  // Close icon SVG
  const closeIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  // Create container
  container = document.createElement('div');
  container.className = `actionchat-container ${config.position}`;

  // Create iframe container
  const iframeContainer = document.createElement('div');
  iframeContainer.className = 'actionchat-iframe-container';

  // Create close button
  closeBtn = document.createElement('button');
  closeBtn.className = 'actionchat-close';
  closeBtn.innerHTML = closeIcon;
  closeBtn.setAttribute('aria-label', 'Close chat');
  closeBtn.onclick = function() {
    toggle(false);
  };
  iframeContainer.appendChild(closeBtn);

  // Create iframe (lazy load)
  iframe = document.createElement('iframe');
  iframe.className = 'actionchat-iframe';
  iframe.setAttribute('title', 'ActionChat Widget');
  iframe.setAttribute('allow', 'clipboard-write');
  iframeContainer.appendChild(iframe);

  container.appendChild(iframeContainer);

  // Create launcher button
  button = document.createElement('button');
  button.className = 'actionchat-button';
  button.innerHTML = chatIcon;
  button.setAttribute('aria-label', 'Open chat');
  button.onclick = function() {
    toggle(!isOpen);
  };
  container.appendChild(button);

  // Toggle function
  function toggle(open) {
    isOpen = open;
    iframeContainer.classList.toggle('open', isOpen);
    button.innerHTML = isOpen ? closeIcon : chatIcon;
    button.setAttribute('aria-label', isOpen ? 'Close chat' : 'Open chat');

    // Lazy load iframe src
    if (isOpen && !iframe.src) {
      iframe.src = `${config.baseUrl}/embed/${config.token}`;
    }
  }

  // Add to page
  document.body.appendChild(container);

  // Open if configured to start open
  if (config.startOpen) {
    toggle(true);
  }

  // Expose API
  window.ActionChat = {
    open: function() { toggle(true); },
    close: function() { toggle(false); },
    toggle: function() { toggle(!isOpen); },
    isOpen: function() { return isOpen; },
  };
})();
