import React from 'react';
import { Download, MessageCircle, CheckCircle, XCircle, Copy, Calendar, User, CreditCard, Gamepad2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import type { Order, OrderStatus } from '@/types';

interface OrderDetailModalProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  onUpdateStatus?: (orderId: string, status: OrderStatus) => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  open,
  onClose,
  onUpdateStatus,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [receiptPreviewFailed, setReceiptPreviewFailed] = React.useState(false);

  React.useEffect(() => {
    setReceiptPreviewFailed(false);
  }, [order?.$id, order?.order_number]);

  if (!order) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-MY', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number | string) => {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numericAmount)) return 'RM 0.00';
    return `RM ${numericAmount.toFixed(2)}`;
  };

  const copyOrderNumber = () => {
    navigator.clipboard.writeText(order.order_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const buildSupplierOrder = () => [
    `/order ${order.supplier_code || order.product_name} ${order.user_game_id}${order.user_game_server ? ` ${order.user_game_server}` : ''}`,
    '',
    `Order: ${order.order_number}`,
    `Game: ${order.game_name}`,
    `Product: ${order.product_name}`,
    order.user_game_id ? `Game ID: ${order.user_game_id}` : '',
    order.user_game_server ? `Server: ${order.user_game_server}` : '',
    order.user_nickname ? `Nickname: ${order.user_nickname}` : '',
    `Amount: ${formatCurrency(order.total_amount)}`,
  ].filter(Boolean).join('\n');

  const copySupplierOrder = async () => {
    await navigator.clipboard.writeText(buildSupplierOrder());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsappNumber = '60197661697';
  const whatsappMessage = `Hi, I'm inquiring about my order *${order.order_number}* for *${order.game_name}*.`;
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto rounded-2xl border-slate-800 bg-slate-950 p-4 text-white animate-slide-up sm:p-6">
        <DialogHeader>
          <div className="flex items-center justify-between gap-8">
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent sm:text-2xl">
              Order Details
            </DialogTitle>
            <StatusBadge status={order.status} />
          </div>
          <DialogDescription className="text-slate-400">
            View complete order information including game details, payment status, and user information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Info with Copy */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="bg-slate-800/50 rounded-xl p-5 transition-all duration-300 hover:bg-slate-800/70">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-400">Order Number</p>
                <button
                  onClick={copyOrderNumber}
                  className="p-1 hover:bg-slate-700 rounded-lg transition-all duration-300 hover:scale-110"
                  title="Copy order number"
                >
                  {copied ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
              <p className="text-lg font-semibold text-white font-mono tracking-wider">
                {order.order_number}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-5 transition-all duration-300 hover:bg-slate-800/70">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <p className="text-sm text-slate-400">Order Date</p>
              </div>
              <p className="text-lg font-semibold text-white">{formatDate(order.created_at)}</p>
            </div>
          </div>

          {/* Game Info */}
          <div className="bg-slate-800/50 rounded-xl p-5 transition-all duration-300 hover:bg-slate-800/70">
            <div className="flex items-center gap-2 mb-4">
              <Gamepad2 className="w-5 h-5 text-violet-400" />
              <h4 className="text-sm font-medium text-white">Game Information</h4>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Game</p>
                <p className="text-white font-medium">{order.game_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Product</p>
                <p className="text-white font-medium">{order.product_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Price</p>
                <p className="text-white font-medium">{formatCurrency(order.price)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Quantity</p>
                <p className="text-white font-medium">{order.quantity}</p>
              </div>
            </div>
          </div>

          {/* User Details */}
          <div className="bg-slate-800/50 rounded-xl p-5 transition-all duration-300 hover:bg-slate-800/70">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-fuchsia-400" />
              <h4 className="text-sm font-medium text-white">User Details</h4>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Game ID</p>
                <p className="text-white font-medium font-mono text-sm">{order.user_game_id}</p>
              </div>
              {order.user_game_server && (
                <div>
                  <p className="text-sm text-slate-500">Server</p>
                  <p className="text-white font-medium">{order.user_game_server}</p>
                </div>
              )}
              {order.user_nickname && (
                <div>
                  <p className="text-sm text-slate-500">Nickname</p>
                  <p className="text-white font-medium">{order.user_nickname}</p>
                </div>
              )}
              {order.user_email && (
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="text-white font-medium">{order.user_email}</p>
                </div>
              )}
              {order.user_phone && (
                <div>
                  <p className="text-sm text-slate-500">Phone</p>
                  <p className="text-white font-medium">{order.user_phone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-slate-800/50 rounded-xl p-5 transition-all duration-300 hover:bg-slate-800/70">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              <h4 className="text-sm font-medium text-white">Payment Information</h4>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Payment Method</p>
                <p className="text-white font-medium">{order.payment_method_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Amount</p>
                <p className="text-2xl font-bold text-violet-400">{formatCurrency(order.total_amount)}</p>
              </div>
            </div>

            {order.receipt_validation && (
              <div className={`mt-4 rounded-xl border p-4 text-sm ${
                order.receipt_validation.accepted
                  ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
                  : 'border-red-400/20 bg-red-400/10 text-red-100'
              }`}>
                <p className="font-medium">{order.receipt_validation.message}</p>
                <div className="mt-2 grid grid-cols-1 gap-1 text-xs opacity-85 sm:grid-cols-2">
                  <span>Recipient: {order.receipt_validation.recipientMatched ? 'Matched' : 'Not matched'}</span>
                  <span>Time: {order.receipt_validation.timeMatched ? 'Within 5 minutes' : 'Outside window'}</span>
                  <span>Amount: {order.receipt_validation.amountMatched ? 'Matched' : 'Not matched'}</span>
                  {order.receipt_validation.manipulationRisk && (
                    <span>Manipulation risk: {order.receipt_validation.manipulationRisk.toUpperCase()}</span>
                  )}
                  {order.receipt_validation.ocrConfidence !== undefined && (
                    <span>OCR confidence: {order.receipt_validation.ocrConfidence}%</span>
                  )}
                  {order.receipt_validation.detectedAmount !== undefined && (
                    <span>Detected: RM {order.receipt_validation.detectedAmount.toFixed(2)}</span>
                  )}
                </div>
                {order.receipt_validation.manipulationFlags && order.receipt_validation.manipulationFlags.length > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100">
                    <p className="mb-1 font-semibold">Manipulation checks</p>
                    <ul className="list-disc space-y-1 pl-4">
                      {order.receipt_validation.manipulationFlags.map((flag) => (
                        <li key={flag}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Receipt Image */}
          {order.receipt_image_url && (
            <div className="bg-slate-800/50 rounded-xl p-5 transition-all duration-300 hover:bg-slate-800/70">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-medium text-white">Payment Receipt</h4>
                <a href={order.receipt_image_url} download={`receipt-${order.order_number}.jpg`}>
                  <Button variant="secondary" size="sm" className="gap-2 bg-slate-800/90 hover:bg-slate-700">
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                </a>
              </div>
              <div className="relative group">
                {!receiptPreviewFailed ? (
                  <img
                    src={order.receipt_image_url}
                    alt="Payment Receipt"
                    className="max-h-[70dvh] w-full rounded-lg border border-slate-700 object-contain transition-all duration-300 group-hover:shadow-xl"
                    onError={() => setReceiptPreviewFailed(true)}
                  />
                ) : (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                    Receipt preview could not render on this device. Use the download button above to open the receipt file.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Admin Notes */}
          {order.admin_notes && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
              <h4 className="text-sm font-medium text-amber-400 mb-2">Admin Notes</h4>
              <p className="text-white text-sm">{order.admin_notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row">
            {order.status === 'pending' && onUpdateStatus && (
              <div className="flex gap-3 flex-1">
                <Button
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white transition-all duration-300 hover:scale-105"
                  onClick={() => {
                    onUpdateStatus(order.$id!, 'success');
                    onClose();
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark as Success
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 transition-all duration-300 hover:scale-105"
                  onClick={() => {
                    onUpdateStatus(order.$id!, 'failed');
                    onClose();
                  }}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Mark as Failed
                </Button>
              </div>
            )}
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button 
                variant="outline" 
                className="w-full gap-2 border-green-500 text-green-400 hover:bg-green-500/10 transition-all duration-300 hover:scale-105 group"
              >
                <MessageCircle className="w-4 h-4 transition-transform group-hover:scale-110" />
                Contact Customer
              </Button>
            </a>
            <Button
              variant="outline"
              className="flex-1 gap-2 border-cyan-500 text-cyan-300 hover:bg-cyan-500/10 transition-all duration-300 hover:scale-105"
              onClick={copySupplierOrder}
            >
              <Copy className="w-4 h-4" />
              Copy Supplier Order
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
