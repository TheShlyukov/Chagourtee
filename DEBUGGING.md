# Отладка приложения Chagourtee

Для включения отладочных сообщений в приложении Chagourtee используйте переменную окружения `DEBUG_MODE`.

## Установка переменной DEBUG_MODE

### В файле .env
Создайте или отредактируйте файл `.env` в корне проекта:

```
DEBUG_MODE=true
```

### При запуске сервера
```bash
DEBUG_MODE=true npm run dev
```

### При запуске клиентской части
Если вы используете Vite, вы можете установить переменную в файле `vite.config.ts`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.DEBUG_MODE': process.env.DEBUG_MODE === 'true' ? '"true"' : '"false"'
  }
})
```

## Виды отладочных сообщений

В приложении используются следующие уровни отладки:

- `DEBUG_MODE=true`: Все отладочные сообщения
- `DEBUG_MODE=info`: Только информационные сообщения
- `DEBUG_MODE=warn`: Предупреждения и ошибки

## Как работают отладочные сообщения

### На клиенте
На клиентской стороне все отладочные сообщения проходят через специальный логгер:

```typescript
import { logger } from '../utils/logger';

logger.debug('Это сообщение будет показано только при DEBUG_MODE=true');
logger.info('Это информационное сообщение');
logger.warn('Это предупреждение');
logger.error('Это сообщение об ошибке (всегда отображается)');
```

### На сервере
На серверной стороне используется логгер Fastify:

```javascript
if (process.env.DEBUG_MODE === 'true') {
  fastify.log.info('Это сообщение будет показано только при DEBUG_MODE=true');
}
```

## Файлы с отладочными сообщениями

Следующие файлы содержат отладочные сообщения:

- `client/src/pages/Chat.tsx`
- `client/src/websocket.ts`
- `client/src/AuthContext.tsx`
- `server/src/ws.js`
- `server/src/messages.js`