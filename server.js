
const express = require("express");
const axios = require("axios");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();

// List of backend servers to ping
const servers = [
  "https://haven-furnitures.onrender.com/api/health",
  "https://amanicentrecbo-n8x0.onrender.com/api/health"
];

// Email config
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const EMAIL_TO = process.env.EMAIL_TO || process.env.EMAIL_USER;

let errorLog = [];

// Simple endpoint to check health
app.get("/", (req, res) => {
  res.json({ status: "Ping service running 🚀" });
});


// Helper: sleep for ms
const sleep = ms => new Promise(res => setTimeout(res, ms));

// Ping a single server with retries and timeout
async function safePing(server, retries = 2, delay = 1000) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      await axios.get(server, { timeout: 5000 });
      console.log(`[${new Date().toISOString()}] ✅ Pinged: ${server}`);
      return true;
    } catch (err) {
      const msg = `[${new Date().toISOString()}] ❌ Error pinging ${server} (attempt ${attempt}): ${err.message}`;
      console.error(msg);
      if (attempt === retries + 1) {
        errorLog.push(msg);
        await sendErrorEmail(server, msg);
      }
      if (attempt <= retries) await sleep(delay);
    }
  }
  return false;
}

// Send error email immediately
async function sendErrorEmail(server, message) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: EMAIL_TO,
      subject: `Ping Service Error: ${server}`,
      text: message,
    });
    console.log(`Error email sent for ${server}`);
  } catch (err) {
    console.error("Failed to send error email:", err.message);
  }
}

// Function to ping servers safely, one at a time with delay
const pingServers = async () => {
  for (const server of servers) {
    await safePing(server);
    await sleep(2000); // 2s between pings to avoid burst
  }
};

// Send daily report email
async function sendDailyReport() {
  const now = new Date();
  const subject = `Daily Ping Report - ${now.toISOString().slice(0, 10)}`;
  const text = errorLog.length
    ? `Errors detected:\n\n${errorLog.join("\n")}\n\n`
    : "All servers were pinged successfully today.";
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: EMAIL_TO,
      subject,
      text,
    });
    console.log("Daily report email sent.");
    errorLog = [];
  } catch (err) {
    console.error("Failed to send daily report email:", err.message);
  }
}

// Schedule daily report at midnight
const now = new Date();
const millisTillMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5, 0) - now;
setTimeout(function() {
  sendDailyReport();
  setInterval(sendDailyReport, 24 * 60 * 60 * 1000);
}, millisTillMidnight);

// Run every 5 minutes
setInterval(pingServers, 5 * 60 * 1000);

module.exports = app;
