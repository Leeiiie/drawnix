import { useState, useEffect, useRef, useCallback } from 'react';
import { Drawnix } from '@drawnix/drawnix';
import { PlaitBoard, PlaitElement, PlaitTheme, Viewport, BoardTransforms } from '@plait/core';
import { 
  MessageToDrawnix, 
  setupMessageListener, 
  sendMessageToParent
} from '../utils/postMessageBridge';

type AppValue = {
  children: PlaitElement[];
  viewport?: Viewport;
  theme?: PlaitTheme;
};

export function App() {
  const [value, setValue] = useState<AppValue>({ children: [] });
  const [isReady, setIsReady] = useState(false);
  const boardRef = useRef<PlaitBoard | null>(null);
  const latestValueRef = useRef<AppValue>({ children: [] });
  
  // 标记是否在 iframe 中运行
  const isInIframe = window.self !== window.top;

  // 处理来自父窗口的消息
  const handleParentMessage = useCallback((message: MessageToDrawnix) => {
    console.log('[App] 处理消息:', message.type);

    switch (message.type) {
      case 'INIT':
        sendMessageToParent({
          type: 'READY',
          requestId: message.requestId
        });
        break;

      case 'LOAD_DATA':
        if (message.data) {
          console.log('[App] 加载数据:', message.data.children?.length || 0, '个元素');
          const newValue: AppValue = {
            children: message.data.children || [],
            viewport: message.data.viewport,
            theme: message.data.theme
          };
          setValue(newValue);
          latestValueRef.current = newValue;

          sendMessageToParent({
            type: 'DATA_LOADED',
            requestId: message.requestId
          });

          // 延迟调用 fitViewport
          setTimeout(() => {
            if (boardRef.current) {
              try {
                BoardTransforms.fitViewport(boardRef.current);
              } catch (e) {
                console.warn('[App] fitViewport 失败:', e);
              }
            }
          }, 200);
        }
        break;

      case 'GET_DATA':
        console.log('[App] 返回数据:', latestValueRef.current.children?.length || 0, '个元素');
        sendMessageToParent({
          type: 'DATA_RESPONSE',
          requestId: message.requestId,
          data: {
            children: latestValueRef.current.children,
            viewport: latestValueRef.current.viewport,
            theme: latestValueRef.current.theme
          }
        });
        break;

      case 'CLEAR':
        console.log('[App] 清空数据');
        setValue({ children: [] });
        latestValueRef.current = { children: [] };
        sendMessageToParent({
          type: 'DATA_RESPONSE',
          requestId: message.requestId,
          data: { children: [] }
        });
        break;

      default:
        console.warn('[App] 未知消息类型:', message.type);
    }
  }, []);

  // 设置消息监听
  useEffect(() => {
    if (!isInIframe) {
      console.log('[App] 非 iframe 环境,使用本地模式');
      return;
    }

    console.log('[App] 设置 postMessage 监听');
    const cleanup = setupMessageListener(handleParentMessage);

    // 通知父窗口已准备就绪
    setTimeout(() => {
      sendMessageToParent({
        type: 'READY'
      });
    }, 100);

    return cleanup;
  }, [isInIframe, handleParentMessage]);

  // 使用 onValueChange - 只有 children 真正变化时才触发
  // 这是 Drawnix 提供的专用回调，比 onChange 更精准
  const handleValueChange = useCallback((newChildren: PlaitElement[]) => {
    console.log('[App] 内容变更:', newChildren.length, '个元素');
    const newValue = {
      ...latestValueRef.current,
      children: newChildren
    };
    latestValueRef.current = newValue;

    // 通知父窗口
    if (isInIframe) {
      sendMessageToParent({
        type: 'DATA_CHANGED',
        data: {
          children: newChildren,
          viewport: latestValueRef.current.viewport,
          theme: latestValueRef.current.theme
        }
      });
    }
  }, [isInIframe]);

  // 视口变化时更新
  const handleViewportChange = useCallback((viewport: Viewport) => {
    latestValueRef.current = {
      ...latestValueRef.current,
      viewport
    };
  }, []);

  // Board 初始化回调
  const handleBoardInit = useCallback((board: PlaitBoard) => {
    console.log('[App] Board 初始化完成');
    boardRef.current = board;
    setIsReady(true);

    // 初始化完成后延迟调用 fitViewport
    setTimeout(() => {
      try {
        BoardTransforms.fitViewport(board);
      } catch (e) {
        console.warn('[App] fitViewport 失败:', e);
      }
    }, 100);
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <Drawnix
        value={value.children}
        viewport={value.viewport}
        theme={value.theme}
        onValueChange={handleValueChange}
        onViewportChange={handleViewportChange}
        afterInit={handleBoardInit}
        tutorial={false}
      />
    </div>
  );
}

export default App;
