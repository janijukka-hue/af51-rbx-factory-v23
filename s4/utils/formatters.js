// s4/utils/formatters.js
// ALX Factory - Formatting Utilities
// Version: 1.0.0

function formatBytes(bytes, decimals) {
  if (decimals === undefined) decimals = 1;
  if (bytes === 0) return "0 B";

  var k = 1024;
  var sizes = ["B", "KB", "MB", "GB", "TB"];
  var i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i];
}

function formatDuration(ms) {
  if (ms < 1000) return ms + "ms";
  if (ms < 60000) return (ms / 1000).toFixed(1) + "s";
  if (ms < 3600000) return Math.floor(ms / 60000) + "m " + Math.floor((ms % 60000) / 1000) + "s";
  return Math.floor(ms / 3600000) + "h " + Math.floor((ms % 3600000) / 60000) + "m";
}

function formatRelativeTime(date) {
  var now = new Date();
  var then = new Date(date);
  var diffMs = now - then;
  var diffSec = Math.floor(diffMs / 1000);
  var diffMin = Math.floor(diffSec / 60);
  var diffHour = Math.floor(diffMin / 60);
  var diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return diffMin + "m ago";
  if (diffHour < 24) return diffHour + "h ago";
  if (diffDay < 7) return diffDay + "d ago";

  return then.toLocaleDateString();
}

function formatISODate(date) {
  var d = new Date(date);
  return d.toISOString().split("T")[0];
}

function formatTime(date) {
  var d = new Date(date);
  return d.toLocaleTimeString();
}

function truncate(str, maxLength) {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatPercent(value, decimals) {
  if (decimals === undefined) decimals = 0;
  return (value * 100).toFixed(decimals) + "%";
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function camelToTitle(str) {
  if (!str) return "";
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, function(s) { return s.toUpperCase(); })
    .trim();
}

export {
  formatBytes,
  formatDuration,
  formatRelativeTime,
  formatISODate,
  formatTime,
  truncate,
  formatNumber,
  formatPercent,
  capitalize,
  camelToTitle
};