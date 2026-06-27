const Razorpay = require('razorpay');

const key_id = 'rzp_test_S5iJuPus3ggxkS';
const key_secret = 'x1YuOZBSy1g6SL64QNi8C7jL';

console.log('Testing Razorpay keys...');
console.log('Key ID:', key_id);
// hiding secret in logs slightly
console.log('Key Secret: ' + key_secret.substring(0, 4) + '...');

try {
  const razorpay = new Razorpay({
    key_id: key_id,
    key_secret: key_secret,
  });

  razorpay.orders
    .create({
      amount: 50000, // 500 INR
      currency: 'INR',
      receipt: 'test_receipt_' + Date.now(),
    })
    .then((order) => {
      console.log('SUCCESS: Order created successfully!');
      console.log('Order ID:', order.id);
    })
    .catch((error) => {
      console.error('FAILURE: Could not create order.');
      console.error('Error:', error);
    });
} catch (e) {
  console.error('Initialization Error:', e);
}
