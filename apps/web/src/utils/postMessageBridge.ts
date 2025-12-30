/**
 * postMessage 通信桥接层
 * 用于 Drawnix 服务与主项目之间的通信
 */

export interface MessageToDrawnix {
  type: 'INIT' | 'LOAD_DATA' | 'GET_DATA' | 'CLEAR';
  requestId: string;
  data?: {
    children: any[];
    viewport?: {
      x: number;
      y: number;
      zoom: number;
    };
    theme?: {
      colorMode?: 'light' | 'dark';
    };
  };
}

export interface MessageFromDrawnix {
  type: 'READY' | 'DATA_LOADED' | 'DATA_CHANGED' | 'DATA_RESPONSE' | 'ERROR';
  requestId?: string;
  data?: {
    children: any[];
    viewport?: any;
    theme?: any;
  };
  error?: string;
}

// 允许的父窗口来源
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

// 缓存检测到的父窗口 origin
let detectedParentOrigin: string | null = null;

/**
 * 检测并缓存父窗口的 origin
 */
export function detectParentOrigin(origin: string): void {
  if (isValidOrigin(origin) && !detectedParentOrigin) {
    detectedParentOrigin = origin;
    console.log('[postMessageBridge] 检测到父窗口 origin:', origin);
  }
}

/**
 * 发送消息到父窗口
 * 只发送到检测到的父窗口 origin，避免大量错误日志
 */
export function sendMessageToParent(message: MessageFromDrawnix) {
  if (window.parent && window.parent !== window) {
    // 如果已检测到父窗口 origin，只发送到该 origin
    if (detectedParentOrigin) {
      try {
        window.parent.postMessage(message, detectedParentOrigin);
        // 只对重要消息打印日志
        if (message.type !== 'DATA_CHANGED') {
          console.log('[postMessageBridge] 发送消息:', message.type);
        }
      } catch (e) {
        console.error('[postMessageBridge] 发送消息失败:', e);
      }
    } else {
      // 首次发送 READY 消息时，使用 * 通配符
      if (message.type === 'READY') {
        try {
          window.parent.postMessage(message, '*');
          console.log('[postMessageBridge] 发送 READY 消息 (广播模式)');
        } catch (e) {
          console.error('[postMessageBridge] 发送 READY 消息失败:', e);
        }
      }
    }
  }
}

/**
 * 验证消息来源
 */
export function isValidOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * 监听父窗口消息
 */
export function setupMessageListener(
  onMessage: (message: MessageToDrawnix) => void
) {
  const handleMessage = (event: MessageEvent) => {
    // 验证来源
    if (!isValidOrigin(event.origin)) {
      return;
    }

    // 检测并缓存父窗口 origin
    detectParentOrigin(event.origin);

    const message = event.data as MessageToDrawnix;
    
    // 验证消息格式
    if (!message || !message.type) {
      return;
    }

    console.log('[postMessageBridge] 收到消息:', message.type);
    onMessage(message);
  };

  window.addEventListener('message', handleMessage);

  // 返回清理函数
  return () => {
    window.removeEventListener('message', handleMessage);
  };
}
