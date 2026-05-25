import type { Order } from '@/types';

const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || '60137345871';

const formatCurrency = (amount: number | string) => {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `RM ${(numericAmount || 0).toFixed(2)}`;
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '-';

  return new Date(dateString).toLocaleString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const buildOrderWhatsAppMessage = (order: Order) => [
  'Hi NickStore, I just placed an order.',
  '',
  `Order ID: ${order.order_number}`,
  `Status: ${order.status}`,
  `Game: ${order.game_name}`,
  `Product: ${order.product_name}`,
  order.denomination ? `Denomination: ${order.denomination}` : '',
  `Total: ${formatCurrency(order.total_amount)}`,
  `Payment: ${order.payment_method_name}`,
  '',
  `Game ID: ${order.user_game_id}`,
  order.user_game_server ? `Server: ${order.user_game_server}` : '',
  order.user_nickname ? `Nickname: ${order.user_nickname}` : '',
  order.user_phone ? `Phone: ${order.user_phone}` : '',
  order.user_email ? `Email: ${order.user_email}` : '',
  '',
  `Order date: ${formatDate(order.created_at)}`,
  order.receipt_validation?.message ? `Receipt check: ${order.receipt_validation.message}` : '',
  '',
  'I have uploaded the receipt on the website.',
].filter(Boolean).join('\n');

export const getOrderWhatsAppLink = (order: Order) =>
  `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(buildOrderWhatsAppMessage(order))}`;

export const getSupportWhatsAppLink = (message = 'Hi, I need assistance with my order.') =>
  `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
