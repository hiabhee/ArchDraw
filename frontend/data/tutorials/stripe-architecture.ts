import { defineTutorial, level, step } from '@/lib/tutorial/builder';

const stripeTutorial = defineTutorial({
  id: 'stripe-architecture',
  title: 'How to Design Stripe Architecture',
  description: 'Build the payments platform that processes billions of dollars. Learn about payment processing, idempotency, and financial compliance.',
  difficulty: 'advanced',
  estimatedMinutes: 70,
  tags: ['payments', 'fintech', 'compliance'],
  icon: 'CreditCard',
  color: '#635BFF',

  levels: [
    level({
      title: 'Payments Foundation',
      steps: [
        step({
          component: 'Web Client',
          nodeType: 'client_web',
          noConnect: true,
          phases: {
            context: { heading: 'Welcome to Stripe Architecture', body: 'Stripe processes over $1 trillion annually. Every payment must be idempotent (no double charges), compliant (PCI DSS), and available 99.999% of the time.' },
            intro: { heading: 'About the Web Client', body: 'The Web Client is the merchant\'s website or app that integrates Stripe\'s SDK to collect payment information from customers.' },
            teaching: { heading: 'Deep dive: Web Client', body: 'Stripe\'s client-side SDK (Stripe.js) tokenizes card information directly in the browser — raw card numbers never touch the merchant\'s server. This eliminates PCI DSS scope for the merchant. The SDK handles card validation, 3D Secure authentication, and error recovery. Without client-side tokenization, every merchant would need to handle raw card data, dramatically increasing security risk and compliance costs.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Web Client', and add the Web Client." },
            connecting: { heading: 'Connect it up', body: 'First step — no connections yet.' },
            celebration: { heading: 'Great job!', body: 'Web Client added.' },
          },
          hints: ['Search for "Web Client"'],
        }),
        step({
          component: 'API Gateway',
          nodeType: 'api_gateway',
          parent: 'Web Client',
          phases: {
            context: { heading: 'Step 2: API Gateway', body: 'Every Stripe API call — charges, refunds, subscriptions — routes through the API Gateway with idempotency keys to prevent duplicate operations.' },
            intro: { heading: 'About API Gateways', body: 'API gateways route requests, enforce rate limits, and provide a unified interface to backend payment services.' },
            teaching: { heading: 'Deep dive: API Gateway', body: 'Stripe\'s API Gateway enforces idempotency — every request includes an idempotency key that ensures the same operation is never executed twice, even if the client retries. It routes charges to the Payment Service, subscription changes to the Billing Service, and webhook delivery to the Webhook Handler. The gateway must maintain 99.999% availability because downtime means merchants cannot process payments.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'API Gateway', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect Web Client \u2192 API Gateway.' },
            celebration: { heading: 'Great job!', body: 'API Gateway added.' },
          },
          hints: ['Search for "API Gateway"', 'Connect Web Client to it'],
        }),
        step({
          component: 'Payment Service',
          nodeType: 'payment_service',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Step 3: Payment Service', body: 'The Payment Service is the core engine — it orchestrates the entire charge lifecycle from authorization to settlement.' },
            intro: { heading: 'About Payment Services', body: 'Payment services manage the full lifecycle of a transaction: authorization, capture, settlement, and refunds.' },
            teaching: { heading: 'Deep dive: Payment Service', body: 'When a customer clicks "Pay", the Payment Service: (1) validates the tokenized card, (2) sends an authorization request to the card network (Visa/Mastercard), (3) receives approval/decline, (4) captures the funds, (5) settles with the merchant\'s bank. This entire flow must complete in under 2 seconds. The service handles 500+ payment methods across 195 countries and must retry failed authorizations with exponential backoff without double-charging.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Payment Service', and add the Payment Service." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Payment Service.' },
            celebration: { heading: 'Great job!', body: 'Payment Service added.' },
          },
          hints: ['Search for "Payment Service"', 'Connect API Gateway to it'],
        }),
        step({
          component: 'Payment Gateway',
          nodeType: 'payment_gateway',
          parent: 'Payment Service',
          phases: {
            context: { heading: 'Step 4: Payment Gateway', body: 'The Payment Gateway communicates with card networks (Visa, Mastercard, Amex) and banks to authorize and settle transactions.' },
            intro: { heading: 'About Payment Gateways', body: 'Payment gateways are the bridge between your payment system and the traditional banking/card network infrastructure.' },
            teaching: { heading: 'Deep dive: Payment Gateway', body: 'Stripe\'s Payment Gateway connects to 1,350+ financial institutions worldwide. It translates Stripe\'s internal payment format into each network\'s proprietary protocol (Visa\'s VISANet, Mastercard\'s Banknet). It handles currency conversion in real-time, routes transactions to the cheapest qualifying network (cost optimization), and manages failover between backup processors. Without a multi-processor gateway, Stripe would be dependent on a single bank — if that bank goes down, all payments fail.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Payment Gateway', and add the Payment Gateway." },
            connecting: { heading: 'Connect it up', body: 'Connect Payment Service \u2192 Payment Gateway.' },
            celebration: { heading: 'Great job!', body: 'Payment Gateway added.' },
          },
          hints: ['Search for "Payment Gateway"', 'Connect Payment Service to it'],
        }),
        step({
          component: 'Ledger',
          nodeType: 'sql_db',
          parent: 'Payment Service',
          phases: {
            context: { heading: 'Step 5: Ledger', body: 'Stripe\'s Ledger is a double-entry accounting system that records every financial event with immutable audit trails.' },
            intro: { heading: 'About Ledgers', body: 'Double-entry ledgers record every financial transaction as both a debit and credit, ensuring the books always balance.' },
            teaching: { heading: 'Deep dive: Ledger', body: 'The Ledger uses double-entry bookkeeping: every charge creates a debit on the customer\'s balance and a credit on the merchant\'s balance. This ensures mathematical correctness — the sum of all debits always equals the sum of all credits. The Ledger is append-only (never updated or deleted) for audit compliance. It powers Stripe\'s real-time revenue reporting, balance calculations, and regulatory filings. Without a proper ledger, financial discrepancies would be impossible to detect or audit.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Ledger', and add the Ledger." },
            connecting: { heading: 'Connect it up', body: 'Connect Payment Service \u2192 Ledger.' },
            celebration: { heading: 'Great job!', body: 'Ledger added.' },
          },
          hints: ['Search for "Ledger"', 'Connect Payment Service to it'],
        }),
      ],
    }),
    level({
      title: 'Production Layer',
      steps: [
        step({
          component: 'Auth Service',
          nodeType: 'auth_service',
          parent: 'API Gateway',
          phases: {
            context: { heading: 'Level 2: Auth Service', body: 'Stripe authenticates API keys, manages merchant permissions, and enforces per-account rate limits and transaction caps.' },
            intro: { heading: 'About Auth Services', body: 'Auth services validate API credentials, enforce permissions, and prevent unauthorized access to payment operations.' },
            teaching: { heading: 'Deep dive: Auth Service', body: 'The Auth Service validates Stripe API keys (sk_live_xxx, pk_live_xxx), checks merchant permissions (can this key create charges? issue refunds?), and enforces per-account rate limits. It also manages OAuth for Stripe Connect platforms — where a marketplace manages payments on behalf of thousands of sellers. Without proper auth, unauthorized users could create charges or issue refunds on any account.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Auth Service', and add it." },
            connecting: { heading: 'Connect it up', body: 'Connect API Gateway \u2192 Auth Service.' },
            celebration: { heading: 'Great job!', body: 'Auth Service added.' },
          },
          hints: ['Search for "Auth Service"', 'Connect API Gateway to it'],
        }),
      ],
    }),
    level({
      title: 'Expert Architecture',
      steps: [
        step({
          component: 'Webhook Handler',
          nodeType: 'webhook_dispatcher',
          parent: 'Payment Service',
          phases: {
            context: { heading: 'Level 3: Webhook Handler', body: 'Webhooks notify merchants when payments succeed, fail, or require action. Stripe retries failed webhooks with exponential backoff for up to 3 days.' },
            intro: { heading: 'About Webhooks', body: 'Webhooks are HTTP callbacks that notify external systems when events occur in your platform.' },
            teaching: { heading: 'Deep dive: Webhook Handler', body: 'When a payment completes, the Webhook Handler sends a signed HTTP POST to the merchant\'s endpoint with the payment details. If the merchant\'s server is down, Stripe retries with exponential backoff (1min, 5min, 30min, 2hr, 24hr) for up to 3 days. Each webhook includes a signature so the merchant can verify authenticity. Webhooks are critical for async payment flows — a merchant needs to know when a subscription renews, a dispute is filed, or a payout completes.' },
            action: { heading: 'Your turn!', body: "Press \u2318K, search for 'Webhook Handler', and add the Webhook Handler." },
            connecting: { heading: 'Connect it up', body: 'Connect Payment Service \u2192 Webhook Handler.' },
            celebration: { heading: 'Great job!', body: 'Webhook Handler added. Your Stripe architecture is complete!' },
          },
          hints: ['Search for "Webhook Handler"', 'Connect Payment Service to it'],
        }),
      ],
    }),
  ],
});

export default stripeTutorial;
