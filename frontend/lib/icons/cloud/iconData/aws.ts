/**
 * AWS icon set — `serviceKey → SVG path data` (24×24 viewBox, single fill).
 * Starter set covering the AWS services in `dictionaries.ts`. Paths reuse the
 * existing hand-drawn glyphs already shipped in `components/icons/AWSIcon.tsx`
 * so AWS rendering is pixel-identical to today. Loaded lazily on first AWS
 * toggle activation.
 */

export const AWS_ICON_PATHS: Record<string, string> = {
  'aws-lambda':
    'M17.64 6.35L12 10.5l-5.64-4.15L12 2l5.64 4.35zM12 22l-5.64-4.15L12 13.5l5.64 4.35L12 22zm0-8.5l-5.64-4.15L12 5l5.64 4.35L12 13.5z',
  'aws-ec2': 'M4 4h16v4H4V4zm0 6h16v4H4v-4zm0 6h16v4H4v-4z',
  'aws-ecs': 'M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2z',
  'aws-eks': 'M12 2L4 5v6l8 4 8-4V5l-8-3zm0 3l5.33 2L12 9.67 6.67 7 12 5z',
  'aws-s3': 'M12 2L4 5v6l8 4 8-4V5l-8-3zm0 3l5.33 2L12 9.67 6.67 7 12 5zm-6 5l5.33 2.67L12 14.33 6.67 12.67 6 12zm6 5l-5.33-2.67L12 17.33l5.33-2.67L18 17z',
  'aws-rds':
    'M12 2C6.48 2 2 4.69 2 7v10c0 2.31 4.48 5 10 5s10-2.69 10-5V7c0-2.31-4.48-5-10-5zm0 2c4.42 0 8 1.79 8 3s-3.58 3-8 3-8-1.79-8-3 3.58-3 8-3zm-8 9v6h16v-6H4zm2 2h4v2H6v-2zm6 0h6v2h-6v-2z',
  'aws-dynamodb': 'M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2z',
  'aws-elasticache':
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z',
  'aws-api-gateway': 'M12 2L4 5v6l8 4 8-4V5l-8-3zm0 3l5.33 2L12 9.67 6.67 7 12 5zm-6 5l5.33 2.67L12 14.33 6.67 12.67 6 10zm6 5l-5.33-2.67L12 15.33l5.33-2.67L18 15z',
  'aws-cloudfront':
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z',
  'aws-alb': 'M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1.06 13.54L7.4 12l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.64 5.66z',
  'aws-sqs': 'M4 4h16v4H4V4zm0 6h16v4H4v-4zm0 6h16v4H4v-4z',
  'aws-sns': 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  'aws-eventbridge':
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  'aws-cognito': 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  'aws-secrets-manager':
    'M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-3.1-2c1.71 0 3.1 1.39 3.1 3.1V8H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2c0 1.71-1.39 3.1-3.1 3.1-1.71 0-3.1-1.39-3.1-3.1V6z',
  'aws-cloudwatch':
    'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 9h2v6H7V9zm4-2h2v8h-2V7zm4 4h2v4h-2v-4z',
  'aws-kinesis':
    'M2 8c1.75-1.75 3.5-1.75 5.25 0s3.5 1.75 5.25 0 3.5-1.75 5.25 0M2 14c1.75-1.75 3.5-1.75 5.25 0s3.5 1.75 5.25 0 3.5-1.75 5.25 0',
  'aws-redshift':
    'M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v3H7V7zm0 5h6v5H7v-5zm8 0h2v5h-2v-5z',
  'aws-msk':
    'M6 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM9 9l6 6M9 15l6-6',
  'aws-batch': 'M4 4h16v16H4V4zm2 2v12h12V6H6zm5 10l-3-3 1.4-1.4L11 13.2l4.6-4.6L17 10l-6 6z',
  'aws-opensearch':
    'M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z',
};
