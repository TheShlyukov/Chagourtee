export const errorTranslations: Record<string, string> = {
  // Authentication errors
  'Invalid login or password': 'Неверный логин или пароль',
  'Login and password required': 'Необходимо указать логин и пароль',
  'Login already taken': 'Логин уже занят',
  'Invite required': 'Требуется инвайт',
  'Invalid invite': 'Неверный инвайт',
  'Invite expired': 'Срок действия инвайта истёк',
  'Invite limit reached': 'Достигнут лимит использования инвайта',
  'Password must be a non-empty string': 'Пароль должен быть непустой строкой',
  'Login must be 2-32 characters long and contain only letters and numbers': 'Логин должен быть длиной 2-32 символа и содержать только буквы и цифры',
  'Account verification required': 'Требуется подтверждение аккаунта',
  'Account pending verification': 'Аккаунт ожидает подтверждения',
  
  // Generic errors
  'Ошибка входа': 'Ошибка входа',
  'Ошибка регистрации': 'Ошибка регистрации',
  'HTTP 400': 'Некорректный запрос',
  'HTTP 401': 'Неавторизованный доступ',
  'HTTP 403': 'Доступ запрещён',
  'HTTP 404': 'Страница не найдена',
  'HTTP 500': 'Внутренняя ошибка сервера',
  
  // Network errors
  'Network error': 'Ошибка сети',
};