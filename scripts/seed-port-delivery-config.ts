/**
 * Seed script: add delivery config fields to `lube_oil_prices` collection docs
 * using Shell Marine Price Guide data (Port Price Differentials + Lead Times).
 *
 * This updates existing lube_oil_prices docs (per port+country, all suppliers)
 * with delivery fields: differentialPer100L, leadTimeDays, smallOrderThresholdL,
 * smallOrderSurcharge, urgentOrderSurcharge.
 *
 * Usage: npx tsx scripts/seed-port-delivery-config.ts
 */

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env without requiring dotenv
const envPath = resolve(__dirname, '../.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local may not exist in some environments
}

interface PortDeliveryConfig {
  portName: string;
  country: string;
  differentialPer100L: number;
  leadTimeDays: number;
  smallOrderThresholdL: number;
  smallOrderSurcharge: number;
  urgentOrderSurcharge: number;
}

// Shell Marine Price Guide — Port Price Differentials (USD per 100L) & Lead Times
// Source: Shell Marine Price Guide April 2022
const SHELL_PORT_DATA: PortDeliveryConfig[] = [
  // ── AUSTRALIA ──
  { portName: 'Adelaide', country: 'AU', differentialPer100L: 50, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Brisbane', country: 'AU', differentialPer100L: 44, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Bunbury', country: 'AU', differentialPer100L: 50, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Cairns', country: 'AU', differentialPer100L: 55, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Darwin', country: 'AU', differentialPer100L: 71, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Fremantle', country: 'AU', differentialPer100L: 44, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Geelong', country: 'AU', differentialPer100L: 50, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Geraldton', country: 'AU', differentialPer100L: 55, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Gladstone', country: 'AU', differentialPer100L: 50, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Hay Point', country: 'AU', differentialPer100L: 55, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Hobart', country: 'AU', differentialPer100L: 55, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Kwinana', country: 'AU', differentialPer100L: 44, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Mackay', country: 'AU', differentialPer100L: 55, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Melbourne', country: 'AU', differentialPer100L: 44, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Newcastle', country: 'AU', differentialPer100L: 44, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Port Hedland', country: 'AU', differentialPer100L: 55, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Port Kembla', country: 'AU', differentialPer100L: 50, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Portland', country: 'AU', differentialPer100L: 55, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Sydney', country: 'AU', differentialPer100L: 44, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Townsville', country: 'AU', differentialPer100L: 55, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Westernport', country: 'AU', differentialPer100L: 50, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Whyalla', country: 'AU', differentialPer100L: 55, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── NEW ZEALAND ──
  { portName: 'Auckland', country: 'NZ', differentialPer100L: 50, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Christchurch', country: 'NZ', differentialPer100L: 55, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Lyttelton', country: 'NZ', differentialPer100L: 55, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Marsden Point', country: 'NZ', differentialPer100L: 55, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Napier', country: 'NZ', differentialPer100L: 55, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Nelson', country: 'NZ', differentialPer100L: 55, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'New Plymouth', country: 'NZ', differentialPer100L: 55, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Tauranga', country: 'NZ', differentialPer100L: 50, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Wellington', country: 'NZ', differentialPer100L: 55, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── SINGAPORE ──
  { portName: 'Singapore', country: 'SG', differentialPer100L: 14, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── MALAYSIA ──
  { portName: 'Bintulu', country: 'MY', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Kemaman', country: 'MY', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Kota Kinabalu', country: 'MY', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Kuantan', country: 'MY', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Labuan', country: 'MY', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Miri', country: 'MY', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Pasir Gudang', country: 'MY', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Penang', country: 'MY', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Port Klang', country: 'MY', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Sandakan', country: 'MY', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Tanjung Pelepas', country: 'MY', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── INDONESIA ──
  { portName: 'Balikpapan', country: 'ID', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Belawan', country: 'ID', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Jakarta', country: 'ID', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Surabaya', country: 'ID', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Tanjung Priok', country: 'ID', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── THAILAND ──
  { portName: 'Bangkok', country: 'TH', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Laem Chabang', country: 'TH', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Map Ta Phut', country: 'TH', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Songkhla', country: 'TH', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Sri Racha', country: 'TH', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── VIETNAM ──
  { portName: 'Ho Chi Minh City', country: 'VN', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Hai Phong', country: 'VN', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Vung Tau', country: 'VN', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── PHILIPPINES ──
  { portName: 'Batangas', country: 'PH', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Cebu', country: 'PH', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Manila', country: 'PH', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Subic Bay', country: 'PH', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── CHINA ──
  { portName: 'Dalian', country: 'CN', differentialPer100L: 22, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Fuzhou', country: 'CN', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Guangzhou', country: 'CN', differentialPer100L: 22, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Huangpu', country: 'CN', differentialPer100L: 22, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Lianyungang', country: 'CN', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Nanjing', country: 'CN', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Ningbo', country: 'CN', differentialPer100L: 22, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Qingdao', country: 'CN', differentialPer100L: 22, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Shanghai', country: 'CN', differentialPer100L: 17, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Shantou', country: 'CN', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Shekou', country: 'CN', differentialPer100L: 22, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Tianjin', country: 'CN', differentialPer100L: 22, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Xiamen', country: 'CN', differentialPer100L: 22, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Yantian', country: 'CN', differentialPer100L: 22, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Zhanjiang', country: 'CN', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Zhoushan', country: 'CN', differentialPer100L: 22, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── HONG KONG ──
  { portName: 'Hong Kong', country: 'HK', differentialPer100L: 22, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── TAIWAN ──
  { portName: 'Kaohsiung', country: 'TW', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Keelung', country: 'TW', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Taichung', country: 'TW', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── JAPAN ──
  { portName: 'Chiba', country: 'JP', differentialPer100L: 14, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Hakata', country: 'JP', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Hiroshima', country: 'JP', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Kawasaki', country: 'JP', differentialPer100L: 14, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Kobe', country: 'JP', differentialPer100L: 17, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Mizushima', country: 'JP', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Nagoya', country: 'JP', differentialPer100L: 17, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Osaka', country: 'JP', differentialPer100L: 17, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Sakai', country: 'JP', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Tokyo', country: 'JP', differentialPer100L: 14, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Yokohama', country: 'JP', differentialPer100L: 14, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── SOUTH KOREA ──
  { portName: 'Busan', country: 'KR', differentialPer100L: 17, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Daesan', country: 'KR', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Gwangyang', country: 'KR', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Incheon', country: 'KR', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Onsan', country: 'KR', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Ulsan', country: 'KR', differentialPer100L: 17, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Yeosu', country: 'KR', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── INDIA ──
  { portName: 'Chennai', country: 'IN', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Cochin', country: 'IN', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Haldia', country: 'IN', differentialPer100L: 39, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Kandla', country: 'IN', differentialPer100L: 39, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Kolkata', country: 'IN', differentialPer100L: 39, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Mangalore', country: 'IN', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Mumbai', country: 'IN', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'New Mangalore', country: 'IN', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Nhava Sheva', country: 'IN', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Paradip', country: 'IN', differentialPer100L: 39, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Tuticorin', country: 'IN', differentialPer100L: 39, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Visakhapatnam', country: 'IN', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── SRI LANKA ──
  { portName: 'Colombo', country: 'LK', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── PAKISTAN ──
  { portName: 'Karachi', country: 'PK', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── BANGLADESH ──
  { portName: 'Chittagong', country: 'BD', differentialPer100L: 39, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── UAE ──
  { portName: 'Abu Dhabi', country: 'AE', differentialPer100L: 17, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Dubai', country: 'AE', differentialPer100L: 17, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Fujairah', country: 'AE', differentialPer100L: 14, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Jebel Ali', country: 'AE', differentialPer100L: 17, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Khor Fakkan', country: 'AE', differentialPer100L: 17, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Sharjah', country: 'AE', differentialPer100L: 17, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── OMAN ──
  { portName: 'Muscat', country: 'OM', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Salalah', country: 'OM', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Sohar', country: 'OM', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── QATAR ──
  { portName: 'Doha', country: 'QA', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Ras Laffan', country: 'QA', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── BAHRAIN ──
  { portName: 'Bahrain', country: 'BH', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── KUWAIT ──
  { portName: 'Kuwait', country: 'KW', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── SAUDI ARABIA ──
  { portName: 'Dammam', country: 'SA', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Jeddah', country: 'SA', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Jubail', country: 'SA', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Ras Tanura', country: 'SA', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Yanbu', country: 'SA', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── EGYPT ──
  { portName: 'Alexandria', country: 'EG', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Damietta', country: 'EG', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Port Said', country: 'EG', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Suez', country: 'EG', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── SOUTH AFRICA ──
  { portName: 'Cape Town', country: 'ZA', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Durban', country: 'ZA', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Port Elizabeth', country: 'ZA', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Richards Bay', country: 'ZA', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Saldanha Bay', country: 'ZA', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── KENYA ──
  { portName: 'Mombasa', country: 'KE', differentialPer100L: 33, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── TANZANIA ──
  { portName: 'Dar Es Salaam', country: 'TZ', differentialPer100L: 39, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── MAURITIUS ──
  { portName: 'Port Louis', country: 'MU', differentialPer100L: 33, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── NETHERLANDS ──
  { portName: 'Amsterdam', country: 'NL', differentialPer100L: 8, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Rotterdam', country: 'NL', differentialPer100L: 6, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── BELGIUM ──
  { portName: 'Antwerp', country: 'BE', differentialPer100L: 8, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Ghent', country: 'BE', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Zeebrugge', country: 'BE', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── GERMANY ──
  { portName: 'Bremerhaven', country: 'DE', differentialPer100L: 8, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Hamburg', country: 'DE', differentialPer100L: 8, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Wilhelmshaven', country: 'DE', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── FRANCE ──
  { portName: 'Dunkirk', country: 'FR', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Fos Sur Mer', country: 'FR', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Le Havre', country: 'FR', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Marseille', country: 'FR', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Nantes', country: 'FR', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── UK ──
  { portName: 'Belfast', country: 'GB', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Felixstowe', country: 'GB', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Grangemouth', country: 'GB', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Immingham', country: 'GB', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Liverpool', country: 'GB', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'London', country: 'GB', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Milford Haven', country: 'GB', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Southampton', country: 'GB', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Teesport', country: 'GB', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── IRELAND ──
  { portName: 'Cork', country: 'IE', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Dublin', country: 'IE', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── SPAIN ──
  { portName: 'Algeciras', country: 'ES', differentialPer100L: 8, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Barcelona', country: 'ES', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Bilbao', country: 'ES', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Cartagena', country: 'ES', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Las Palmas', country: 'ES', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Tarragona', country: 'ES', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Valencia', country: 'ES', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── PORTUGAL ──
  { portName: 'Leixoes', country: 'PT', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Lisbon', country: 'PT', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Sines', country: 'PT', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── ITALY ──
  { portName: 'Augusta', country: 'IT', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Genoa', country: 'IT', differentialPer100L: 8, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'La Spezia', country: 'IT', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Livorno', country: 'IT', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Naples', country: 'IT', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Ravenna', country: 'IT', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Taranto', country: 'IT', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Trieste', country: 'IT', differentialPer100L: 11, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Venice', country: 'IT', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── GREECE ──
  { portName: 'Piraeus', country: 'GR', differentialPer100L: 8, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Thessaloniki', country: 'GR', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── TURKEY ──
  { portName: 'Aliaga', country: 'TR', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Gemlik', country: 'TR', differentialPer100L: 17, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Istanbul', country: 'TR', differentialPer100L: 11, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Izmir', country: 'TR', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Mersin', country: 'TR', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Tuzla', country: 'TR', differentialPer100L: 11, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── MALTA ──
  { portName: 'Marsaxlokk', country: 'MT', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── CROATIA ──
  { portName: 'Rijeka', country: 'HR', differentialPer100L: 17, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── SLOVENIA ──
  { portName: 'Koper', country: 'SI', differentialPer100L: 17, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── POLAND ──
  { portName: 'Gdansk', country: 'PL', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Gdynia', country: 'PL', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Szczecin', country: 'PL', differentialPer100L: 17, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── DENMARK ──
  { portName: 'Copenhagen', country: 'DK', differentialPer100L: 11, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Fredericia', country: 'DK', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── SWEDEN ──
  { portName: 'Gothenburg', country: 'SE', differentialPer100L: 11, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Malmo', country: 'SE', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Stockholm', country: 'SE', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── NORWAY ──
  { portName: 'Bergen', country: 'NO', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Oslo', country: 'NO', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Stavanger', country: 'NO', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── FINLAND ──
  { portName: 'Helsinki', country: 'FI', differentialPer100L: 17, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Kotka', country: 'FI', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── ESTONIA ──
  { portName: 'Tallinn', country: 'EE', differentialPer100L: 17, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── LATVIA ──
  { portName: 'Riga', country: 'LV', differentialPer100L: 17, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── LITHUANIA ──
  { portName: 'Klaipeda', country: 'LT', differentialPer100L: 17, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── RUSSIA ──
  { portName: 'Novorossiysk', country: 'RU', differentialPer100L: 22, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'St Petersburg', country: 'RU', differentialPer100L: 22, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Vladivostok', country: 'RU', differentialPer100L: 33, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── MOROCCO ──
  { portName: 'Casablanca', country: 'MA', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Tangier', country: 'MA', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── USA — EAST COAST ──
  { portName: 'Baltimore', country: 'US', differentialPer100L: 14, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Boston', country: 'US', differentialPer100L: 14, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Charleston', country: 'US', differentialPer100L: 14, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Jacksonville', country: 'US', differentialPer100L: 14, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Miami', country: 'US', differentialPer100L: 14, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'New Orleans', country: 'US', differentialPer100L: 11, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'New York', country: 'US', differentialPer100L: 11, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Newark', country: 'US', differentialPer100L: 11, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Norfolk', country: 'US', differentialPer100L: 14, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Philadelphia', country: 'US', differentialPer100L: 14, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Savannah', country: 'US', differentialPer100L: 14, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Tampa', country: 'US', differentialPer100L: 14, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── USA — GULF COAST ──
  { portName: 'Corpus Christi', country: 'US', differentialPer100L: 14, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Galveston', country: 'US', differentialPer100L: 11, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Houston', country: 'US', differentialPer100L: 8, leadTimeDays: 2, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Lake Charles', country: 'US', differentialPer100L: 14, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Mobile', country: 'US', differentialPer100L: 14, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Port Arthur', country: 'US', differentialPer100L: 11, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── USA — WEST COAST ──
  { portName: 'Long Beach', country: 'US', differentialPer100L: 11, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Los Angeles', country: 'US', differentialPer100L: 11, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Oakland', country: 'US', differentialPer100L: 14, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Portland', country: 'US', differentialPer100L: 14, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'San Francisco', country: 'US', differentialPer100L: 14, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Seattle', country: 'US', differentialPer100L: 14, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Tacoma', country: 'US', differentialPer100L: 14, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── CANADA ──
  { portName: 'Halifax', country: 'CA', differentialPer100L: 17, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Montreal', country: 'CA', differentialPer100L: 17, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Vancouver', country: 'CA', differentialPer100L: 14, leadTimeDays: 3, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── MEXICO ──
  { portName: 'Altamira', country: 'MX', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Manzanillo', country: 'MX', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Veracruz', country: 'MX', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── PANAMA ──
  { portName: 'Balboa', country: 'PA', differentialPer100L: 17, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Cristobal', country: 'PA', differentialPer100L: 17, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── COLOMBIA ──
  { portName: 'Buenaventura', country: 'CO', differentialPer100L: 28, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Cartagena', country: 'CO', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── BRAZIL ──
  { portName: 'Paranagua', country: 'BR', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Rio De Janeiro', country: 'BR', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Santos', country: 'BR', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Vitoria', country: 'BR', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── ARGENTINA ──
  { portName: 'Buenos Aires', country: 'AR', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── CHILE ──
  { portName: 'San Antonio', country: 'CL', differentialPer100L: 33, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Valparaiso', country: 'CL', differentialPer100L: 28, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── PERU ──
  { portName: 'Callao', country: 'PE', differentialPer100L: 28, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── JAMAICA ──
  { portName: 'Kingston', country: 'JM', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── TRINIDAD ──
  { portName: 'Point Lisas', country: 'TT', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Port Of Spain', country: 'TT', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── DJIBOUTI ──
  { portName: 'Djibouti', country: 'DJ', differentialPer100L: 33, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── ISRAEL ──
  { portName: 'Ashdod', country: 'IL', differentialPer100L: 17, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Haifa', country: 'IL', differentialPer100L: 17, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── JORDAN ──
  { portName: 'Aqaba', country: 'JO', differentialPer100L: 22, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── CYPRUS ──
  { portName: 'Limassol', country: 'CY', differentialPer100L: 14, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── ROMANIA ──
  { portName: 'Constanta', country: 'RO', differentialPer100L: 17, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── BULGARIA ──
  { portName: 'Bourgas', country: 'BG', differentialPer100L: 22, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Varna', country: 'BG', differentialPer100L: 22, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── MYANMAR ──
  { portName: 'Yangon', country: 'MM', differentialPer100L: 39, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── CAMBODIA ──
  { portName: 'Sihanoukville', country: 'KH', differentialPer100L: 39, leadTimeDays: 10, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── BRUNEI ──
  { portName: 'Muara', country: 'BN', differentialPer100L: 33, leadTimeDays: 5, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── PAPUA NEW GUINEA ──
  { portName: 'Lae', country: 'PG', differentialPer100L: 55, leadTimeDays: 20, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
  { portName: 'Port Moresby', country: 'PG', differentialPer100L: 55, leadTimeDays: 20, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },

  // ── FIJI ──
  { portName: 'Suva', country: 'FJ', differentialPer100L: 55, leadTimeDays: 20, smallOrderThresholdL: 4000, smallOrderSurcharge: 200, urgentOrderSurcharge: 200 },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'one-cosmos');
    const collName = process.env.COLLECTION_PRICES || 'lube_oil_prices';
    const col = db.collection(collName);

    console.log(`Seeding ${SHELL_PORT_DATA.length} port delivery configs into "${collName}" (lube_oil_prices)...`);

    let matched = 0;
    let modified = 0;
    let noMatch = 0;

    const deliveryFields = {
      differentialPer100L: 0,
      leadTimeDays: 0,
      smallOrderThresholdL: 0,
      smallOrderSurcharge: 0,
      urgentOrderSurcharge: 0,
    };

    for (const config of SHELL_PORT_DATA) {
      // Match by port name (case-insensitive) — Country field in DB uses full names
      // (e.g. "SINGAPORE") not ISO codes, so we match on Port only
      const escapedPort = config.portName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const result = await col.updateMany(
        { Port: { $regex: new RegExp(`^${escapedPort}$`, 'i') } },
        {
          $set: {
            differentialPer100L: config.differentialPer100L,
            leadTimeDays: config.leadTimeDays,
            smallOrderThresholdL: config.smallOrderThresholdL,
            smallOrderSurcharge: config.smallOrderSurcharge,
            urgentOrderSurcharge: config.urgentOrderSurcharge,
          },
        }
      );
      matched += result.matchedCount;
      modified += result.modifiedCount;
      if (result.matchedCount === 0) {
        noMatch++;
      }
    }

    console.log(`Done. Matched: ${matched} docs, Modified: ${modified} docs, No match: ${noMatch} ports`);
    if (noMatch > 0) {
      const unmatchedPorts: string[] = [];
      for (const config of SHELL_PORT_DATA) {
        const escapedPort = config.portName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const count = await col.countDocuments({ Port: { $regex: new RegExp(`^${escapedPort}$`, 'i') } });
        if (count === 0) {
          unmatchedPorts.push(`${config.portName} (${config.country})`);
        }
      }
      if (unmatchedPorts.length > 0) {
        console.log(`Ports with no matching price docs (${unmatchedPorts.length}):`);
        for (const p of unmatchedPorts) console.log(`  - ${p}`);
      }
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
