// functions for email validation and transactional email
const nodemailer = require('nodemailer');

let transporter = null;

// builds the SMTP transport lazily so the app boots without mail credentials
function getTransporter() {
  if (!transporter && process.env.MAILGUN_CREDENTIALS) {
    transporter = nodemailer.createTransport({
      service: 'Mailgun',
      auth: {
        user: 'email_confirmation@noreply.mutorials.org',
        pass: process.env.MAILGUN_CREDENTIALS,
      },
    });
  }
  return transporter;
}

// sends a one-time code to a user; resolves false (never throws) on failure
async function emailCodeSend(address, code) {
  const mailer = getTransporter();
  if (!mailer) {
    console.error('MAILGUN_CREDENTIALS is not set; cannot send email.');
    return false;
  }
  try {
    await mailer.sendMail({
      from: 'email_confirmation@noreply.mutorials.org',
      to: address,
      subject: 'Mutorials Confirmation Code',
      text:
        'Here is your Mutorials code: ' +
        code +
        '\n\nIt expires in 15 minutes. If you did not request it, you can ignore this email.',
    });
    return true;
  } catch (err) {
    console.error('Email send failed:', err.message);
    return false;
  }
}

// returns true if the address is a plausible email (bounded, single @, dotted domain)
function regexCheck(address) {
  if (
    typeof address !== 'string' ||
    address.length < 3 ||
    address.length > 254
  ) {
    return false;
  }
  return /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/.test(address);
}

module.exports = { emailCodeSend, regexCheck };
