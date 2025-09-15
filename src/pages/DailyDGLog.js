// src/components/DailyDGLog1.js
import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import "../assets/DailyDGLog.css";
import * as XLSX from "xlsx";


const getFormattedDate = () => {
  const d = new Date();
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
};

const DailyDGLog = ({ userData }) => {
  const [form, setForm] = useState({ Date: getFormattedDate() });
  const [logs, setLogs] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );

  // Define this with your other constants (before the component)
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [dgCapacity, setDgCapacity] = useState("");
  const [dgKw, setDgKw] = useState("");
  const [dgHmr, setDgHmr] = useState("");
  const [calculationResult, setCalculationResult] = useState("");
  const [selectedCapacity, setSelectedCapacity] = useState("");

  const dgCapacityOptions = [
    "82.5 kVA", "125.0 kVA", "160.0 kVA", "180.0 kVA", "200.0 kVA",
    "250.0 kVA", "320.0 kVA", "380.0 kVA", "400.0 kVA", "500.0 kVA",
    "600.0 kVA", "625.0 kVA", "650.0 kVA", "750.0 kVA", "1010.0 kVA",
    "1250.0 kVA", "1500.0 kVA", "2000.0 kVA", "2250.0 kVA", "2500.0 kVA"
  ];

  // Define this outside your component (or inside if it doesn't change)
  const oemDieselCphData = {
    "DG Capacity": [82.5, 125.0, 160.0, 180.0, 200.0, 250.0, 320.0, 380.0, 400.0, 500.0, 600.0, 625.0, 650.0, 750.0, 1010.0, 1250.0, 1500.0, 2000.0, 2250.0, 2500.0],
    " 50.0 ": [10.9, 15.8, 21.8, 23.0, 27.1, 29.2, 40.9, 47.9, 50.7, 59.0, 71.7, 74.2, 75.5, 97.2, 108.0, 136.6, 158.6, 200.1, 232.0, 232.0],
    " 75.0 ": [15.7, 22.4, 28.4, 31.8, 34.6, 41.8, 51.8, 63.5, 67.5, 81.6, 96.9, 101.0, 102.7, 132.4, 153.8, 190.8, 231.0, 291.0, 331.0, 331.0],
    " 100.0 ": [20.9, 30.4, 36.9, 41.8, 46.2, 57.5, 68.4, 83.2, 88.0, 106.3, 125.4, 128.2, 132.4, 166.4, 203.8, 251.8, 301.7, 390.0, 441.0, 441.0],
    " C-B ": [4.8, 6.6, 6.7, 8.8, 7.6, 12.6, 10.9, 15.6, 16.7, 22.6, 25.2, 26.8, 27.2, 35.2, 45.8, 54.2, 72.4, 90.9, 99.0, 99.0],
    " D-C ": [5.2, 8.0, 8.5, 10.0, 11.6, 15.7, 16.6, 19.7, 20.6, 24.7, 28.5, 27.2, 29.7, 34.0, 50.0, 61.0, 70.7, 99.0, 110.0, 110.0],
    " Average(E,F) ": [0.2, 0.3, 0.3, 0.4, 0.4, 0.6, 0.6, 0.7, 0.7, 0.9, 1.1, 1.1, 1.1, 1.4, 1.9, 2.3, 2.9, 3.8, 4.2, 4.2],
    "14%": [3.8, 5.3, 10.8, 9.6, 13.3, 8.8, 21.1, 22.5, 23.9, 25.0, 33.1, 35.3, 34.5, 47.4, 39.0, 53.7, 55.6, 63.4, 81.5, 81.5],
    "17%": [4.4, 6.2, 11.8, 10.7, 14.4, 10.5, 22.8, 24.6, 26.1, 27.8, 36.3, 38.6, 37.9, 51.6, 44.8, 60.6, 64.2, 74.8, 94.1, 94.1],
    "19%": [4.8, 6.7, 12.4, 11.4, 15.2, 11.7, 23.9, 26.0, 27.6, 29.7, 38.5, 40.7, 40.2, 54.3, 48.6, 65.2, 69.9, 82.4, 102.4, 102.4],
    "22%": [5.4, 7.6, 13.3, 12.5, 16.3, 13.4, 25.5, 28.2, 29.9, 32.6, 41.7, 44.0, 43.6, 58.5, 54.4, 72.1, 78.5, 93.8, 115.0, 115.0],
    "27%": [6.4, 9.1, 14.8, 14.4, 18.2, 16.2, 28.3, 31.7, 33.6, 37.3, 47.0, 49.4, 49.3, 65.4, 63.9, 83.6, 92.8, 112.7, 135.9, 135.9],
    "28%": [6.6, 9.4, 15.1, 14.8, 18.6, 16.8, 28.8, 32.4, 34.3, 38.2, 48.1, 50.4, 50.4, 66.8, 65.8, 85.9, 95.6, 116.5, 140.0, 140.0],
    "30%": [7.0, 10.0, 15.7, 15.5, 19.4, 17.9, 29.9, 33.8, 35.8, 40.1, 50.3, 52.6, 52.7, 69.6, 69.7, 90.5, 101.4, 124.1, 148.4, 148.4],
    "31%": [7.1, 10.2, 16.0, 15.9, 19.8, 18.5, 30.5, 34.5, 36.6, 41.1, 51.3, 53.7, 53.9, 71.0, 71.6, 92.8, 104.2, 127.9, 152.6, 152.6],
    "32%": [7.3, 10.5, 16.3, 16.3, 20.2, 19.0, 31.0, 35.2, 37.3, 42.0, 52.4, 54.8, 55.0, 72.3, 73.5, 95.1, 107.1, 131.7, 156.8, 156.8],
    "33%": [7.5, 10.8, 16.6, 16.7, 20.5, 19.6, 31.6, 35.9, 38.1, 43.0, 53.5, 55.8, 56.1, 73.7, 75.4, 97.4, 109.9, 135.5, 160.9, 160.9],
    "34%": [7.7, 11.1, 16.9, 17.0, 20.9, 20.2, 32.1, 36.6, 38.8, 43.9, 54.5, 56.9, 57.3, 75.1, 77.3, 99.7, 112.8, 139.3, 165.1, 165.1],
    "35%": [7.9, 11.4, 17.2, 17.4, 21.3, 20.7, 32.7, 37.3, 39.6, 44.8, 55.6, 58.0, 58.4, 76.5, 79.3, 102.0, 115.7, 143.1, 169.3, 169.3],
    "37%": [8.3, 12.0, 17.8, 18.2, 22.1, 21.9, 33.8, 38.7, 41.1, 46.7, 57.8, 60.2, 60.7, 79.3, 83.1, 106.6, 121.4, 150.7, 177.7, 177.7],
    "38%": [8.5, 12.3, 18.1, 18.5, 22.5, 22.4, 34.3, 39.5, 41.8, 47.7, 58.8, 61.2, 61.8, 80.6, 85.0, 109.0, 124.3, 154.5, 181.8, 181.8],
    "39%": [8.7, 12.6, 18.4, 18.9, 22.8, 23.0, 34.9, 40.2, 42.5, 48.6, 59.9, 62.3, 63.0, 82.0, 86.9, 111.3, 127.1, 158.3, 186.0, 186.0],
    "40%": [8.9, 12.9, 18.7, 19.3, 23.2, 23.6, 35.4, 40.9, 43.3, 49.6, 61.0, 63.4, 64.1, 83.4, 88.8, 113.6, 130.0, 162.1, 190.2, 190.2],
    "41%": [9.1, 13.2, 19.0, 19.7, 23.6, 24.1, 36.0, 41.6, 44.0, 50.5, 62.1, 64.5, 65.2, 84.8, 90.8, 115.9, 132.8, 165.9, 194.4, 194.4],
    "42%": [9.3, 13.4, 19.3, 20.0, 24.0, 24.7, 36.5, 42.3, 44.8, 51.5, 63.1, 65.6, 66.4, 86.2, 92.7, 118.2, 135.7, 169.7, 198.6, 198.6],
    "43%": [9.5, 13.7, 19.6, 20.4, 24.4, 25.2, 37.1, 43.0, 45.5, 52.4, 64.2, 66.6, 67.5, 87.6, 94.6, 120.5, 138.6, 173.5, 202.7, 202.7],
    "44%": [9.7, 14.0, 19.9, 20.8, 24.8, 25.8, 37.6, 43.7, 46.3, 53.3, 65.3, 67.7, 68.7, 88.9, 96.5, 122.8, 141.43, 177.3, 206.9, 206.9],
    "45%": [9.9, 14.3, 20.2, 21.2, 25.1, 26.4, 38.2, 44.4, 47.0, 54.3, 66.3, 68.8, 69.8, 90.3, 98.4, 125.1, 144.3, 181.1, 211.1, 211.1],
    "46%": [10.1, 14.6, 20.5, 21.5, 25.5, 26.9, 38.7, 45.1, 47.8, 55.2, 67.4, 69.9, 70.9, 91.7, 100.3, 127.4, 147.2, 184.9, 215.3, 215.3],
    "47%": [10.3, 14.9, 20.8, 21.9, 25.9, 27.5, 39.3, 45.8, 48.5, 56.2, 68.5, 71.0, 72.1, 93.1, 102.3, 129.7, 150.0, 188.7, 219.5, 219.5],
    "48%": [10.5, 15.2, 21.1, 22.3, 26.3, 28.1, 39.8, 46.5, 49.2, 57.1, 69.6, 72.0, 73.2, 94.5, 104.2, 132.0, 152.9, 192.5, 223.6, 223.6],
    "49%": [10.7, 15.5, 21.4, 22.7, 26.7, 28.6, 40.4, 47.2, 50.0, 58.1, 70.6, 73.1, 74.3, 95.9, 106.1, 134.3, 155.7, 196.3, 227.8, 227.8],
    "50%": [10.9, 15.8, 21.8, 23.0, 27.1, 29.2, 40.9, 47.9, 50.7, 59.0, 71.7, 74.2, 75.5, 97.2, 108.0, 136.6, 158.6, 200.1, 232.0, 232.0],
    "51%": [10.9, 15.4, 21.1, 22.8, 25.4, 28.2, 38.6, 46.6, 49.6, 58.9, 71.1, 75.1, 75.4, 99.2, 107.8, 135.5, 162.3, 199.8, 230.7, 230.7],
    "52%": [11.1, 15.7, 21.4, 23.2, 25.8, 28.8, 39.2, 47.3, 50.3, 59.9, 72.2, 76.2, 76.5, 100.6, 109.7, 137.8, 165.2, 203.6, 234.9, 234.9],
    "53%": [11.3, 16.0, 21.7, 23.6, 26.2, 29.4, 39.7, 48.0, 51.1, 60.8, 73.3, 77.2, 77.6, 102.0, 111.6, 140.1, 168.0, 207.4, 239.0, 239.0],
    "54%": [11.5, 16.3, 22.0, 23.9, 26.6, 29.9, 40.3, 48.7, 51.8, 61.7, 74.4, 78.3, 78.8, 103.3, 113.6, 142.4, 170.9, 211.2, 243.2, 243.2],
    "55%": [11.7, 16.6, 22.4, 24.3, 26.9, 30.5, 40.8, 49.4, 52.5, 62.7, 75.4, 79.4, 79.9, 104.7, 115.5, 144.7, 173.8, 215.0, 247.4, 247.4],
    "56%": [11.9, 16.9, 22.7, 24.7, 27.3, 31.1, 41.4, 50.1, 53.3, 63.6, 76.5, 80.5, 81.1, 106.1, 117.4, 147.0, 176.6, 218.8, 251.6, 251.6],
    "57%": [12.1, 17.2, 23.0, 25.1, 27.7, 31.6, 41.9, 50.8, 54.0, 64.6, 77.6, 81.6, 82.2, 107.5, 119.3, 149.3, 179.5, 222.6, 255.8, 255.8],
    "58%": [12.3, 17.4, 23.3, 25.4, 28.1, 32.2, 42.5, 51.5, 54.8, 65.5, 78.7, 82.6, 83.3, 108.9, 121.2, 151.6, 182.3, 226.4, 259.9, 259.9],
    "59%": [12.5, 17.7, 23.6, 25.8, 28.5, 32.8, 43.0, 52.2, 55.5, 66.5, 79.7, 83.7, 84.5, 110.3, 123.1, 153.9, 185.2, 230.2, 264.1, 264.1],
    "60%": [12.7, 18.0, 23.9, 26.2, 28.9, 33.3, 43.6, 52.9, 56.3, 67.4, 80.8, 84.8, 85.6, 111.6, 125.1, 156.2, 188.1, 234.0, 268.3, 268.3],
    "61%": [12.9, 18.3, 24.2, 26.6, 29.2, 33.9, 44.1, 53.6, 57.0, 68.4, 81.9, 85.9, 86.7, 113.0, 127.0, 158.5, 190.9, 237.8, 272.5, 272.5],
    "62%": [13.1, 18.6, 24.5, 26.9, 29.6, 34.5, 44.7, 54.3, 57.8, 69.3, 82.9, 87.0, 87.9, 114.4, 128.9, 160.8, 193.8, 241.6, 276.7, 276.7],
    "63%": [13.3, 18.9, 24.8, 27.3, 30.0, 35.0, 45.2, 55.0, 58.5, 70.2, 84.0, 88.0, 89.0, 115.8, 130.8, 163.2, 196.7, 245.4, 280.8, 280.8],
    "64%": [13.5, 19.2, 25.1, 27.7, 30.4, 35.6, 45.8, 55.7, 59.3, 71.2, 85.1, 89.1, 90.2, 117.2, 132.7, 165.5, 199.5, 249.2, 285.0, 285.0],
    "65%": [13.7, 19.5, 25.4, 28.1, 30.8, 36.2, 46.3, 56.4, 60.0, 72.1, 86.2, 90.2, 91.3, 118.6, 134.6, 167.8, 202.4, 253.0, 289.2, 289.2],
    "66%": [13.9, 19.8, 25.7, 28.4, 31.2, 36.7, 46.9, 57.1, 60.7, 73.1, 87.2, 91.3, 92.4, 119.9, 136.6, 170.1, 205.2, 256.8, 293.4, 293.4],
    "67%": [14.1, 20.1, 26.0, 28.8, 31.5, 37.3, 47.4, 57.9, 61.5, 74.0, 88.3, 92.4, 93.6, 121.3, 138.5, 172.4, 208.1, 260.6, 297.6, 297.6],
    "68%": [14.3, 20.4, 26.3, 29.2, 31.9, 37.9, 48.0, 58.6, 62.2, 75.0, 89.4, 93.4, 94.7, 122.7, 140.4, 174.7, 211.0, 264.4, 301.7, 301.7],
    "69%": [14.5, 20.7, 26.6, 29.6, 32.3, 38.4, 48.5, 59.3, 63.0, 75.9, 90.5, 94.5, 95.9, 124.1, 142.3, 177.0, 213.8, 268.2, 305.9, 305.9],
    "70%": [14.7, 20.9, 26.9, 29.9, 32.7, 39.0, 49.1, 60.0, 63.7, 76.9, 91.5, 95.6, 97.0, 125.5, 144.2, 179.3, 216.7, 272.0, 310.1, 310.1],
    "71%": [14.9, 21.2, 27.2, 30.3, 33.1, 39.6, 49.6, 60.7, 64.5, 77.8, 92.6, 96.7, 98.1, 126.9, 146.1, 181.6, 219.6, 275.8, 314.3, 314.3],
    "72%": [15.1, 21.5, 27.5, 30.7, 33.5, 40.1, 50.2, 61.4, 65.2, 78.8, 93.7, 97.8, 99.3, 128.2, 148.1, 183.9, 222.4, 279.6, 318.5, 318.5],
    "73%": [15.3, 21.8, 27.8, 31.1, 33.8, 40.7, 50.7, 62.1, 66.0, 79.7, 94.7, 98.8, 100.4, 129.6, 150.0, 186.2, 225.3, 283.4, 322.6, 322.6],
    "74%": [15.5, 22.1, 28.1, 31.4, 34.2, 41.3, 51.3, 62.8, 66.7, 80.6, 95.8, 99.9, 101.5, 131.0, 151.9, 188.5, 228.1, 287.2, 326.8, 326.8],
    "75%": [15.7, 22.4, 28.4, 31.8, 34.6, 41.8, 51.8, 63.5, 67.5, 81.6, 96.9, 101.0, 102.7, 132.4, 153.8, 190.8, 231.0, 291.0, 331.0, 331.0],
    "76%": [16.1, 23.4, 29.6, 32.8, 37.0, 43.9, 55.2, 66.3, 70.1, 83.6, 99.6, 102.3, 105.1, 133.2, 157.8, 196.5, 233.0, 298.8, 340.7, 340.7],
    "77%": [16.3, 23.6, 29.9, 33.1, 37.4, 44.5, 55.8, 67.0, 70.9, 84.5, 100.7, 103.4, 106.2, 134.6, 159.7, 198.8, 235.9, 302.6, 344.9, 344.9],
    "78%": [16.5, 23.9, 30.2, 33.5, 37.8, 45.1, 56.3, 67.7, 71.6, 85.5, 101.7, 104.4, 107.3, 136.0, 161.6, 201.1, 238.7, 306.4, 349.0, 349.0],
    "79%": [16.7, 24.2, 30.5, 33.9, 38.2, 45.6, 56.9, 68.4, 72.4, 86.4, 102.8, 105.5, 108.5, 137.4, 163.6, 203.4, 241.6, 310.2, 353.2, 353.2],
    "80%": [16.9, 24.5, 30.8, 34.3, 38.5, 46.2, 57.4, 69.1, 73.1, 87.4, 103.9, 106.6, 109.6, 138.7, 165.5, 205.7, 244.5, 314.0, 357.4, 357.4],
    "81%": [17.1, 24.8, 31.1, 34.6, 38.9, 46.8, 58.0, 69.8, 73.8, 88.3, 105.0, 107.7, 110.8, 140.1, 167.4, 208.0, 247.3, 317.8, 361.6, 361.6],
    "82%": [17.3, 25.1, 31.4, 35.0, 39.3, 47.3, 58.5, 70.5, 74.6, 89.3, 106.0, 108.8, 111.9, 141.5, 169.3, 210.3, 250.2, 321.6, 365.8, 365.8],
    "83%": [17.5, 25.4, 31.7, 35.4, 39.7, 47.9, 59.1, 71.2, 75.3, 90.2, 107.1, 109.8, 113.0, 142.9, 171.2, 212.6, 253.0, 325.4, 369.9, 369.9],
    "84%": [17.7, 25.7, 32.1, 35.8, 40.1, 48.5, 59.6, 71.9, 76.1, 91.2, 108.2, 110.9, 114.2, 144.3, 173.1, 214.9, 255.9, 329.2, 374.1, 374.1],
    "85%": [17.9, 26.0, 32.4, 36.1, 40.5, 49.0, 60.2, 72.6, 76.8, 92.1, 109.3, 112.0, 115.3, 145.7, 175.1, 217.2, 258.8, 333.0, 378.3, 378.3],
    "89%": [18.7, 27.1, 33.6, 37.6, 42.0, 51.3, 62.4, 75.4, 79.8, 95.9, 113.5, 116.3, 119.9, 151.2, 182.7, 226.5, 270.2, 348.2, 395.0, 395.0],
    "90%": [18.9, 27.4, 33.9, 38.0, 42.4, 51.9, 62.9, 76.2, 80.5, 96.8, 114.6, 117.4, 121.0, 152.6, 184.6, 228.8, 273.1, 352.0, 399.2, 399.2],
    "95%": [19.9, 28.9, 35.4, 39.9, 44.3, 54.7, 65.7, 79.7, 84.3, 101.6, 120.0, 122.8, 126.7, 159.5, 194.2, 240.3, 287.4, 371.0, 420.1, 420.1],
    "100%": [20.9, 30.4, 36.9, 41.8, 46.2, 57.5, 68.4, 83.2, 88.0, 106.3, 125.4, 128.2, 132.4, 166.4, 203.8, 251.8, 301.7, 390.0, 441.0, 441.0],
    "112%": [23.3, 33.8, 40.5, 46.2, 50.8, 64.3, 75.0, 91.7, 96.9, 117.6, 138.2, 141.2, 146.0, 183.0, 226.8, 279.4, 336.0, 435.6, 491.2, 491.2],
    // ... include all other percentage columns from your Python data
  };

  const siteName = userData?.site || "UnknownSite";

  const [showEditModal, setShowEditModal] = useState(false);


  const fmt = (val) => (val !== undefined && val !== null ? Number(val).toFixed(2) : "0.0");
  const fmt1 = (val) => (val !== undefined && val !== null ? Number(val).toFixed(1) : "0.0");


  // 🔹 Auto calculations (like Excel)
  const calculateFields = (data) => {
    const result = { ...data };

    // DG Calculations
    for (let i = 1; i <= 2; i++) {
      const kwhOpen = parseFloat(result[`DG-${i} KWH Opening`]) || 0;
      const kwhClose = parseFloat(result[`DG-${i} KWH Closing`]) || 0;
      const fuelOpen = parseFloat(result[`DG-${i} Fuel Opening`]) || 0;
      const fuelClose = parseFloat(result[`DG-${i} Fuel Closing`]) || 0;
      const hrOpen = parseFloat(result[`DG-${i} Hour Opening`]) || 0;
      const hrClose = parseFloat(result[`DG-${i} Hour Closing`]) || 0;
      const fuelFill = parseFloat(result[`DG-${i} Fuel Filling`]) || 0;
      const offLoadFuelCon = parseFloat(result[`DG-${i} Off Load Fuel Consumption`]) || 0;
      const offLoadHrs = parseFloat(result[`DG-${i} Off Load Hour`]) || 0;
      const totalFuelCon = fuelOpen - fuelClose + fuelFill;


      result[`DG-${i} KWH Generation`] = kwhClose - kwhOpen;
      result[`DG-${i} Fuel Consumption`] = totalFuelCon;
      result[`DG-${i} Running Hrs`] = hrClose - hrOpen;
      result[`DG-${i} CPH`] = hrClose > hrOpen && totalFuelCon - offLoadFuelCon > 0 ? (totalFuelCon - offLoadFuelCon) / (hrClose - hrOpen - offLoadHrs) : 0;
      result[`DG-${i} SEGR`] = totalFuelCon - offLoadFuelCon > 0 ? (kwhClose - kwhOpen) / (totalFuelCon - offLoadFuelCon) : 0;
      result[`DG-${i} Run Min`] = (hrClose - hrOpen) * 60;
      result[`DG-${i} ON Load Consumption`] = Math.max(totalFuelCon - offLoadFuelCon, 0);
      result[`DG-${i} OFF Load Consumption`] = offLoadFuelCon;
      result[`DG-${i} ON Load Hour`] = (hrClose - hrOpen - offLoadHrs);
      result[`DG-${i} OFF Load Hour`] = (offLoadHrs);
      result[`DG-${i} Fuel Filling`] = (fuelFill);


      result[`DG-${i} Avg Fuel/Hr`] =
        result[`DG-${i} Running Hrs`] > 0
          ? Number(
            (result[`DG-${i} Fuel Consumption`] /
              result[`DG-${i} Running Hrs`]).toFixed(2)
          )
          : 0;
    }

    // EB Calculations
    for (let i = 1; i <= 2; i++) {
      const ebOpen = parseFloat(result[`EB-${i} KWH Opening`]) || 0;
      const ebClose = parseFloat(result[`EB-${i} KWH Closing`]) || 0;
      result[`EB-${i} KWH Generation`] = ebClose - ebOpen;
    }

    // Totals
    result["Total DG KWH"] =
      (result["DG-1 KWH Generation"] || 0) +
      (result["DG-2 KWH Generation"] || 0);

    result["Total EB KWH"] =
      (result["EB-1 KWH Generation"] || 0) +
      (result["EB-2 KWH Generation"] || 0);

    result["Total DG Fuel"] =
      (result["DG-1 Fuel Consumption"] || 0) +
      (result["DG-2 Fuel Consumption"] || 0);

    result["Total DG Hours"] =
      (result["DG-1 Running Hrs"] || 0) +
      (result["DG-2 Running Hrs"] || 0);

    result["Total Unit Consumption"] =
      (result["DG-1 KWH Generation"] || 0) +
      (result["DG-2 KWH Generation"] || 0) +
      (result["EB-1 KWH Generation"] || 0) +
      (result["EB-2 KWH Generation"] || 0);

    result["Site Running kW"] =
      (result["Total Unit Consumption"] || 0) / 24;

    result["Total Fuel Filling"] =
      (result["DG-1 Fuel Filling"] || 0) +
      (result["DG-2 Fuel Filling"] || 0);
    return result;
  };

  // compute individual DG averages
  const dg1Values = logs
    .map((entry) => calculateFields(entry)["DG-1 SEGR"])
    .filter((val) => val > 0);
  const monthlyAvgDG1SEGR =
    dg1Values.length > 0
      ? (
        dg1Values.reduce((sum, val) => sum + val, 0) / dg1Values.length
      ).toFixed(2)
      : 0;

  const dg2Values = logs
    .map((entry) => calculateFields(entry)["DG-2 SEGR"])
    .filter((val) => val > 0);
  const monthlyAvgDG2SEGR =
    dg2Values.length > 0
      ? (
        dg2Values.reduce((sum, val) => sum + val, 0) / dg2Values.length
      ).toFixed(2)
      : 0;

  // compute monthly average SEGR
  const allSEGRValues = logs.flatMap((entry) => {
    const cl = calculateFields(entry);
    return [cl["DG-1 SEGR"], cl["DG-2 SEGR"]].filter((val) => val > 0);
  });
  const monthlyAvgSEGR =
    allSEGRValues.length > 0
      ? (
        allSEGRValues.reduce((sum, val) => sum + val, 0) / allSEGRValues.length
      ).toFixed(2)
      : 0;

  const formatMonthName = (ym) => {
    const [year, month] = ym.split("-");
    const date = new Date(year, month - 1); // month is 0-based
    return date.toLocaleString("default", { month: "long" }); // , year: "numeric" 
  };

  const formatYear = (ym) => {
    return ym.split("-")[0]; // just the YYYY part
  };


  // 🔹 Fetch logs
  const fetchLogs = async () => {
    if (!siteName) return;
    const monthKey = selectedMonth;
    const logsCol = collection(db, "dailyDGLogs", siteName, monthKey);
    const snapshot = await getDocs(logsCol);


    const data = [];
    snapshot.forEach((docSnap) => {
      data.push({ id: docSnap.id, ...docSnap.data() });
    });
    setLogs(data);
  };

  const getYesterdayData = () => {
    if (!logs.length || !form.Date) return null;

    const selected = new Date(form.Date);     // use selected date
    const yesterdayDate = new Date(selected);
    yesterdayDate.setDate(selected.getDate() - 1);

    const ymd = yesterdayDate.toISOString().split("T")[0];
    return logs.find((entry) => entry.Date === ymd) || null;
  };

  useEffect(() => {
    if (logs.length > 0 && form.Date) {
      const yesterday = getYesterdayData();
      if (yesterday) {
        setForm((prev) => ({
          ...prev,
          Date: form.Date,   // keep current selected date
          "DG-1 KWH Opening": yesterday["DG-1 KWH Closing"] || "",
          "DG-2 KWH Opening": yesterday["DG-2 KWH Closing"] || "",
          "DG-1 Fuel Opening": yesterday["DG-1 Fuel Closing"] || "",
          "DG-2 Fuel Opening": yesterday["DG-2 Fuel Closing"] || "",
          "DG-1 Hour Opening": yesterday["DG-1 Hour Closing"] || "",
          "DG-2 Hour Opening": yesterday["DG-2 Hour Closing"] || "",
          "EB-1 KWH Opening": yesterday["EB-1 KWH Closing"] || "",
          "EB-2 KWH Opening": yesterday["EB-2 KWH Closing"] || "",
        }));
      }
    }
  }, [logs, form.Date]);   // ✅ run also when Date changes


  useEffect(() => {
    fetchLogs();
  }, [selectedMonth, siteName]);

  // 🔹 Handle input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (newDate) => {
    setForm((prev) => ({ ...prev, Date: newDate }));

    // Check if entry already exists for this date
    const existing = logs.find((entry) => entry.Date === newDate);

    if (existing) {
      // ✅ Populate with saved values
      setForm({ ...existing, Date: newDate });
    } else {
      // ✅ If not found, fall back to yesterday’s data
      const selected = new Date(newDate);
      const yesterdayDate = new Date(selected);
      yesterdayDate.setDate(selected.getDate() - 1);
      const ymd = yesterdayDate.toISOString().split("T")[0];

      const yesterday = logs.find((entry) => entry.Date === ymd);

      if (yesterday) {
        setForm({
          Date: newDate,
          "DG-1 KWH Opening": yesterday["DG-1 KWH Closing"] || "",
          "DG-2 KWH Opening": yesterday["DG-2 KWH Closing"] || "",
          "DG-1 Fuel Opening": yesterday["DG-1 Fuel Closing"] || "",
          "DG-2 Fuel Opening": yesterday["DG-2 Fuel Closing"] || "",
          "DG-1 Hour Opening": yesterday["DG-1 Hour Closing"] || "",
          "DG-2 Hour Opening": yesterday["DG-2 Hour Closing"] || "",
          "EB-1 KWH Opening": yesterday["EB-1 KWH Closing"] || "",
          "EB-2 KWH Opening": yesterday["EB-2 KWH Closing"] || "",
        });
      } else {
        // ✅ Empty form if neither current nor yesterday’s exists
        setForm({ Date: newDate });
      }
    }
  };


  // 🔹 Save entry
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.Date) return alert("Date is required");

    // check all required input fields
    for (const field of inputFields) {
      if (form[field] === undefined || form[field] === "") {
        return alert(`Please fill all fields before saving. Missing: ${field}`);
      }
    }

    // ✅ validation
    for (let i = 1; i <= 2; i++) {
      const kwhOpen = parseFloat(form[`DG-${i} KWH Opening`] || 0);
      const kwhClose = parseFloat(form[`DG-${i} KWH Closing`] || 0);
      const hrOpen = parseFloat(form[`DG-${i} Hour Opening`] || 0);
      const hrClose = parseFloat(form[`DG-${i} Hour Closing`] || 0);
      const fuelOpen = parseFloat(form[`DG-${i} Fuel Opening`] || 0);
      const fuelClose = parseFloat(form[`DG-${i} Fuel Closing`] || 0);
      const fuelFill = parseFloat(form[`DG-${i} Fuel Filling`] || 0);
      const offLoadFuelCon = parseFloat(form[`DG-${i} Off Load Fuel Consumption`] || 0);

      if (kwhClose < kwhOpen) {
        return alert(`DG-${i} KWH Closing cannot be less than Opening`);
      }
      if (hrClose < hrOpen) {
        return alert(`DG-${i} Hour Closing cannot be less than Opening`);
      }
      if (fuelFill > 0) {
        // in filling case → Closing must be greater than Opening
        if (fuelClose <= fuelOpen) {
          return alert(`DG-${i} Fuel Closing must be greater than Opening when filling fuel`);
        }
      } else {
        // in normal case → Closing must be less than or equal Opening
        if (fuelClose > fuelOpen) {
          return alert(`DG-${i} Fuel Closing cannot be greater than Opening (no fuel filling)`);
        }
      }
    }

    // EB validation
    for (let i = 1; i <= 2; i++) {
      const ebOpen = parseFloat(form[`EB-${i} KWH Opening`] || 0);
      const ebClose = parseFloat(form[`EB-${i} KWH Closing`] || 0);
      if (ebClose < ebOpen) {
        return alert(`EB-${i} KWH Closing cannot be less than Opening`);
      }
    }

    const monthKey = selectedMonth;
    const docRef = doc(db, "dailyDGLogs", siteName, monthKey, form.Date);

    await setDoc(docRef, { ...form, updatedBy: userData?.name, updatedAt: serverTimestamp() }, { merge: true });

    setForm({ Date: getFormattedDate() });
    fetchLogs();
    setShowEditModal(false);
  };

  // 🔹 Delete log
  const handleDelete = async (id) => {
    const monthKey = selectedMonth;
    await deleteDoc(doc(db, "dailyDGLogs", siteName, monthKey, id));
    fetchLogs();
  };

  // 🔹 Input fields
  const inputFields = [];

  // EBs
  for (let i = 1; i <= 2; i++) {
    inputFields.push(`EB-${i} KWH Opening`, `EB-${i} KWH Closing`);
  }

  // DGs
  for (let i = 1; i <= 2; i++) {
    inputFields.push(
      `DG-${i} KWH Opening`,
      `DG-${i} KWH Closing`,
      `DG-${i} Fuel Opening`,
      `DG-${i} Fuel Closing`,
      `DG-${i} Off Load Fuel Consumption`,
      `DG-${i} Fuel Filling`,
      `DG-${i} Hour Opening`,
      `DG-${i} Hour Closing`,
      `DG-${i} Off Load Hour`,
    );
  }

  // 🔹 Download logs as Excel
  const handleDownloadExcel = () => {
    if (!logs.length) {
      alert("No data available to download");
      return;
    }

    // Map logs with calculations
    const exportData = logs.map((entry) => {
      const calculated = calculateFields(entry);
      return {
        Date: calculated.Date,
        "DG-1 KWH Opening": fmt(calculated["DG-1 KWH Opening"]),
        "DG-1 KWH Closing": fmt(calculated["DG-1 KWH Closing"]),
        "DG-1 Generation": fmt(calculated["DG-1 KWH Generation"]),
        "DG-2 KWH Opening": fmt(calculated["DG-2 KWH Opening"]),
        "DG-2 KWH Closing": fmt(calculated["DG-2 KWH Closing"]),
        "DG-2 Generation": fmt(calculated["DG-2 KWH Generation"]),
        "Total DG KWH Generation": fmt(calculated["Total DG KWH"]),
        "EB-1 KWH Opening": fmt(calculated["EB-1 KWH Opening"]),
        "EB-1 KWH Closing": fmt(calculated["EB-1 KWH Closing"]),
        "EB-1 Generation": fmt(calculated["EB-1 KWH Generation"]),
        "EB-2 KWH Opening": fmt(calculated["EB-2 KWH Opening"]),
        "EB-2 KWH Closing": fmt(calculated["EB-2 KWH Closing"]),
        "EB-2 Generation": fmt(calculated["EB-2 KWH Generation"]),
        "Total EB KWH Generation": fmt(calculated["Total EB KWH"]),
        "DG-1 Run Min": fmt(calculated["DG-1 Run Min"]),
        "DG-2 Run Min": fmt(calculated["DG-2 Run Min"]),
        "DG-1 Fuel Opening": fmt(calculated["DG-1 Fuel Opening"]),
        "DG-1 Fuel Closing": fmt(calculated["DG-1 Fuel Closing"]),
        "DG-1 Fuel Filling": fmt(calculated["DG-1 Fuel Filling"]),
        "DG-1 ON Load Consumption": fmt(calculated["DG-1 ON Load Consumption"]),
        "DG-1 OFF Load Consumption": fmt(calculated["DG-1 OFF Load Consumption"]),
        "DG-1 Fuel Consumption": fmt(calculated["DG-1 Fuel Consumption"]),
        "DG-1 Hour Opening": fmt1(calculated["DG-1 Hour Opening"]),
        "DG-1 Hour Closing": fmt1(calculated["DG-1 Hour Closing"]),
        "DG-1 ON Load Hour": fmt1(calculated["DG-1 ON Load Hour"]),
        "DG-1 OFF Load Hour": fmt1(calculated["DG-1 OFF Load Hour"]),
        "DG-1 Running Hrs": fmt1(calculated["DG-1 Running Hrs"]),
        "DG-1 CPH": fmt(calculated["DG-1 CPH"]),
        "DG-1 SEGR": fmt(calculated["DG-1 SEGR"]),
        "DG-2 Fuel Opening": fmt(calculated["DG-2 Fuel Opening"]),
        "DG-2 Fuel Closing": fmt(calculated["DG-2 Fuel Closing"]),
        "DG-2 Fuel Filling": fmt(calculated["DG-2 Fuel Filling"]),
        "DG-1 Fuel Filling": fmt(calculated["DG-1 Fuel Filling"]),
        "DG-2 ON Load Consumption": fmt(calculated["DG-2 ON Load Consumption"]),
        "DG-2 OFF Load Consumption": fmt(calculated["DG-2 OFF Load Consumption"]),
        "DG-2 Fuel Consumption": fmt(calculated["DG-2 Fuel Consumption"]),
        "DG-2 Hour Opening": fmt1(calculated["DG-2 Hour Opening"]),
        "DG-2 Hour Closing": fmt1(calculated["DG-2 Hour Closing"]),
        "DG-2 ON Load Hour": fmt1(calculated["DG-2 ON Load Hour"]),
        "DG-2 OFF Load Hour": fmt1(calculated["DG-2 OFF Load Hour"]),
        "DG-2 Running Hrs": fmt1(calculated["DG-2 Running Hrs"]),
        "DG-2 CPH": fmt(calculated["DG-2 CPH"]),
        "DG-2 SEGR": fmt(calculated["DG-2 SEGR"]),
        "Total EB Unit": fmt(calculated["Total EB KWH"]),
        "Total DG Unit": fmt(calculated["Total DG KWH"]),
        "Total Unit Consumption(EB+DG)": fmt(calculated["Total Unit Consumption"]),
        "Total Fuel": fmt(calculated["Total DG Fuel"]),
        "Total DG Hours": fmt1(calculated["Total DG Hours"]),
        "Site Running kW": fmt(calculated["Total Unit Consumption"] / 24),
      };
    });

    // Create worksheet + workbook
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DailyDGLogs");

    // Export Excel file
    XLSX.writeFile(wb, `DailyDGLogs_${siteName}_${formatMonthName(selectedMonth)}${formatYear(selectedMonth)}.xlsx`);
  };

  // 🔹 Field validation color
  const getFieldClass = (name) => {
    const [prefix, type] = name.split(" "); // ["DG-1", "KWH", "Opening"]

    if (type === "KWH") {
      const open = parseFloat(form[`${prefix} KWH Opening`]);
      const close = parseFloat(form[`${prefix} KWH Closing`]);
      if (form[`${prefix} KWH Closing`] === "") return "field-red";
      if (!isNaN(open) && !isNaN(close)) {
        return close >= open ? "field-green" : "field-red";
      }
    }

    if (type === "Hour") {
      const open = parseFloat(form[`${prefix} Hour Opening`]);
      const close = parseFloat(form[`${prefix} Hour Closing`]);
      if (form[`${prefix} Hour Closing`] === "") return "field-red";
      if (!isNaN(open) && !isNaN(close)) {
        return close >= open ? "field-green" : "field-red";
      }
    }

    if (type === "Fuel") {
      const open = parseFloat(form[`${prefix} Fuel Opening`]);
      const close = parseFloat(form[`${prefix} Fuel Closing`]);
      const fill = parseFloat(form[`${prefix} Fuel Filling`] || 0);
      if (form[`${prefix} Fuel Closing`] === "") return "field-red";
      if (!isNaN(open) && !isNaN(close)) {
        if (fill > 0) return close > open ? "field-green" : "field-red";
        return close <= open ? "field-green" : "field-red";
      }
    }

    return "";
  };



  // Then in your component, add these functions:
  const findRowDgCapacity = (dgRating) => {
    const capacities = oemDieselCphData["DG Capacity"];
    for (let i = 0; i < capacities.length; i++) {
      if (capacities[i] === dgRating) {
        return i;
      }
    }
    return -1;
  };

  const calculateFuel = () => {
    if (!dgCapacity || !dgKw || !dgHmr) {
      setCalculationResult("Please fill all fields");
      return;
    }

    const capacity = parseFloat(dgCapacity);
    const kw = parseFloat(dgKw);
    const hmr = parseFloat(dgHmr);

    // Calculating kWh
    const dgKwh = kw / hmr;

    // Calculating percentage of DG running
    const runPercent = (dgKwh / (capacity * 0.8)) * 100;
    const roundedPercent = Math.round(runPercent);

    // List of missing percentage columns
    const missingColumnList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 18, 20, 21, 23, 24, 25, 26, 29, 36];

    let result = `\n*********This Is For You*********\n\n`;
    result += `🖋 DG Run Percentage: ${roundedPercent}%....\n`;

    if (missingColumnList.includes(roundedPercent)) {
      const adjustableCPH = hmr * 80;
      const segr = kw / adjustableCPH;
      const reqSegr = 3;

      if (segr < reqSegr) {
        let x;
        for (x = 1; x < adjustableCPH; x++) {
          const adjusFuel = 3 * x;
          if (adjusFuel >= kw) {
            break;
          }
        }
        const finalSegr = kw / x;

        result += `🖋 As per Load % OEM Diesel CPH: OEM CPH Data Not Available for ${roundedPercent}% Load....\n`;
        result += `🖋 Achieve CPH as per Physical Inspection: 80.00 ltrs/Hour....\n`;
        result += `🖋 Total Fuel Consumption for ${hmr * 60} Minutes DG Running: ${adjustableCPH.toFixed(2)} Ltrs....\n`;
        result += `🖋 On Load/Off Load Consumption Details: On Load ${x} ltrs / Off Load ${(adjustableCPH - x).toFixed(2)} ltrs\n`;
        result += `🖋 SEGR Value: ${finalSegr.toFixed(2)} kW/Ltrs.... as per On Load Consumption\n`;
      } else {
        result += `🖋 As per Load % OEM Diesel CPH: OEM CPH Data Not Available for ${roundedPercent}% Load....\n`;
        result += `🖋 Achieve CPH as per Physical Inspection: 80.00 ltrs/Hour....\n`;
        result += `🖋 Total Fuel Consumption for ${hmr * 60} Minutes DG Running: ${adjustableCPH.toFixed(2)} Ltrs....\n`;
        result += `🖋 SEGR Value: ${segr.toFixed(2)} kW/Ltrs....\n`;
      }
    } else {
      const rowIndex = findRowDgCapacity(capacity);
      const oDCPH = oemDieselCphData[`${roundedPercent}%`][rowIndex];
      const totalFuelConsumption = (oDCPH * 1.05) * hmr;
      const segr = kw / totalFuelConsumption;
      const cph = totalFuelConsumption / hmr;

      result += `🖋 As per Load % OEM Diesel CPH: ${oDCPH.toFixed(2)} ltrs/Hour....\n`;
      result += `🖋 Achieve CPH as per Physical Inspection: ${cph.toFixed(2)} ltrs/Hour....\n`;
      result += `🖋 Total Fuel Consumption for ${hmr * 60} Minutes DG Running: ${totalFuelConsumption.toFixed(2)} Ltrs....\n`;
      result += `🖋 SEGR Value: ${segr.toFixed(2)} kW/Ltrs....\n`;
    }

    setCalculationResult(result);
  };


  return (
    <div className="daily-log-container">
      <h1 className="dashboard-header"><strong>☣️ Daily DG Log Book – {formatYear(selectedMonth)}</strong> </h1>
      <h2>{siteName} MSC</h2>
      <label>
        Select Month:
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />
      </label>

      <div className="chart-container" >
        <strong>
          <h1 className={`month ${formatMonthName(selectedMonth)}`}>
            {formatMonthName(selectedMonth)}
          </h1>
        </strong>

        {/* Average SEGR */}
        <h2 className={monthlyAvgSEGR < 3 ? "avg-segr low" : "avg-segr high"}>
          Average SEGR – <strong>{monthlyAvgSEGR}</strong>
        </h2>
        <p className={monthlyAvgDG1SEGR < 3 ? "avg-segr low" : "avg-segr high"}>
          DG-1 Average SEGR – {monthlyAvgDG1SEGR}
        </p>
        <p className={monthlyAvgDG2SEGR < 3 ? "avg-segr low" : "avg-segr high"} >
          DG-2 Average SEGR – {monthlyAvgDG2SEGR}
        </p>

        {/* 🔹 New Monthly Stats */}
        {(() => {
          if (!logs.length) return null;

          // calculate all fields
          const calculatedLogs = logs.map((e) => calculateFields(e));

          // Average DG CPH (combined DG1+DG2)
          const cphValues = calculatedLogs.flatMap((cl) => [
            cl["DG-1 CPH"], cl["DG-2 CPH"],
          ]).filter((v) => v > 0);
          const monthlyAvgCPH =
            cphValues.length > 0
              ? (cphValues.reduce((a, b) => a + b, 0) / cphValues.length).toFixed(2)
              : 0;

          // Totals
          const totalKwh = calculatedLogs.reduce((sum, cl) => sum + (cl["Total DG KWH"] || 0), 0);
          const totalFuel = calculatedLogs.reduce((sum, cl) => sum + (cl["Total DG Fuel"] || 0), 0);
          const totalHrs = calculatedLogs.reduce((sum, cl) => sum + (cl["Total DG Hours"] || 0), 0);
          const totalFilling = calculatedLogs.reduce((sum, cl) => sum + (cl["Total Fuel Filling"] || 0), 0);


          const siteRunningKwValues = calculatedLogs
            .map(cl => cl["Site Running kW"])
            .filter(v => v > 0);

          const avgSiteRunningKw =
            siteRunningKwValues.length > 0
              ? (siteRunningKwValues.reduce((sum, v) => sum + v, 0) / siteRunningKwValues.length).toFixed(2)
              : 0;

          // Indivisual DG Fuel Fill in Ltrs
          const totalDG1Kw =
            calculatedLogs.reduce(
              (sum, cl) => sum + (cl["DG-1 KWH Generation"] || 0),
              0
            );
          const totalDG2Kw =
            calculatedLogs.reduce(
              (sum, cl) => sum + (cl["DG-2 KWH Generation"] || 0),
              0
            );

          // Indivisual DG Fuel Fill in Ltrs
          const totalDG1Filling =
            calculatedLogs.reduce(
              (sum, cl) => sum + (cl["DG-1 Fuel Filling"] || 0),
              0
            );
          const totalDG2Filling =
            calculatedLogs.reduce(
              (sum, cl) => sum + (cl["DG-2 Fuel Filling"] || 0),
              0
            );

          // ON / OFF load Consupmtion
          const totalOnLoadCon =
            calculatedLogs.reduce(
              (sum, cl) => sum + (cl["DG-1 ON Load Consumption"] || 0) + (cl["DG-2 ON Load Consumption"] || 0),
              0
            );
          const totalOffLoadCon =
            calculatedLogs.reduce(
              (sum, cl) => sum + (cl["DG-1 OFF Load Consumption"] || 0) + (cl["DG-2 OFF Load Consumption"] || 0),
              0
            );

          // ON / OFF load hours + minutes
          const totalOnLoadHrs =
            calculatedLogs.reduce(
              (sum, cl) => sum + (cl["DG-1 ON Load Hour"] || 0) + (cl["DG-2 ON Load Hour"] || 0),
              0
            );
          const totalOffLoadHrs =
            calculatedLogs.reduce(
              (sum, cl) => sum + (cl["DG-1 OFF Load Hour"] || 0) + (cl["DG-2 OFF Load Hour"] || 0),
              0
            );

          const totalOnLoadMin = (totalOnLoadHrs * 60).toFixed(0);
          const totalOffLoadMin = (totalOffLoadHrs * 60).toFixed(0);

          return (
            <div className="monthly-stats" >
              <p style={{ fontSize: "25px", textAlign: "center" }}><strong>📊 Summery Data</strong></p>
              <p style={{ borderTop: "3px solid #eee" }}>⚡ Site Running Load – <strong>{fmt(avgSiteRunningKw)} kWh</strong></p>
              <p>⛽ Avg DG CPH – <strong>{monthlyAvgCPH}/Hrs</strong></p>
              <p style={{ borderTop: "1px solid #eee" }}>⚡ Total DG KW Generation – <strong>{fmt(totalKwh)} kW</strong></p>
              <p style={{ marginLeft: "20px" }}>
                • DG-1: <strong>{fmt1(totalDG1Kw)} kW</strong>
              </p>
              <p style={{ marginLeft: "20px" }}>
                • DG-2: <strong>{fmt1(totalDG2Kw)} kW</strong>
              </p>
              <p style={{ borderTop: "1px solid #eee" }}>⛽ Total Fuel Filling – <strong>{fmt(totalFilling)} Ltrs</strong></p>
              <p style={{ marginLeft: "20px" }}>
                • DG-1: <strong>{fmt1(totalDG1Filling)} Ltrs</strong>
              </p>
              <p style={{ marginLeft: "20px" }}>
                • DG-2: <strong>{fmt1(totalDG2Filling)} Ltrs</strong>
              </p>
              <p style={{ borderTop: "1px solid #eee" }}>⛽ Total DG Fuel Consumption – <strong>{fmt(totalFuel)} Ltrs</strong></p>
              <p style={{ marginLeft: "20px" }}>
                • ON Load: <strong>{fmt1(totalOnLoadCon)} Ltrs</strong>
              </p>
              <p style={{ marginLeft: "20px" }}>
                • OFF Load: <strong>{fmt1(totalOffLoadCon)} Ltrs</strong>
              </p>
              <p style={{ borderTop: "1px solid #eee" }}>⏱️ Total DG Run Hours – <strong>{fmt1(totalHrs)} Hour</strong></p>
              <p style={{ marginLeft: "20px" }}>
                • ON Load: <strong>{fmt1(totalOnLoadHrs)} hrs</strong> ({totalOnLoadMin} min)
              </p>
              <p style={{ marginLeft: "20px" }}>
                • OFF Load: <strong>{fmt1(totalOffLoadHrs)} hrs</strong> ({totalOffLoadMin} min)
              </p>
            </div>
          );
        })()}

        {/* Last update info */}
        {(userData?.role === "Super Admin" ||
          userData?.role === "Admin" ||
          userData?.role === "Super User") &&
          (() => {
            const entry = logs.find((e) => e.Date === form.Date);
            return entry ? (
              <p style={{ fontSize: 12, color: "#666" }}>
                Last Update By: <strong>{entry.updatedBy}</strong>{" "}
                {entry.updatedAt?.toDate().toLocaleString()}
              </p>
            ) : null;
          })()
        }
      </div>
      <button
        className="segr-manage-btn"
        onClick={() => setShowFuelModal(true)}
        style={{ width: "100%" }}
      >
        💥 Cummins DG CPH/SEGR Manager
      </button>

      {showFuelModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h1>Cummins DG CPH/SEGR Monitor</h1>
            <h3>WB-AirtelMSCs</h3>

            <div className="form-group">
              <label>Select DG Capacity:</label>
              <select
                value={selectedCapacity}
                onChange={(e) => {
                  setSelectedCapacity(e.target.value);
                  setDgCapacity(parseFloat(e.target.value));
                }}
                className="form-control"
              >
                <option value="">Select Capacity</option>
                {dgCapacityOptions.map((option, index) => (
                  <option key={index} value={parseFloat(option)}>{option}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Enter DG Generated kW:</label>
              <input
                type="number"
                value={dgKw}
                onChange={(e) => setDgKw(e.target.value)}
                className="form-control"
                placeholder="Enter kW"
              />
            </div>

            <div className="form-group">
              <label>Enter DG Hour Meter Reading:</label>
              <input
                type="number"
                value={dgHmr}
                onChange={(e) => setDgHmr(e.target.value)}
                className="form-control"
                placeholder="Enter hours"
                step="0.1"
              />
            </div>

            <div className="button-group">
              <button
                onClick={calculateFuel}
                className="btn-primary"
              >
                Calculate
              </button>
              <button
                onClick={() => {
                  setShowFuelModal(false);
                  setCalculationResult("");
                }}
                className="btn-secondary"
              >
                Close
              </button>
            </div>

            {calculationResult && (
              <div className="result-container">
                <h4>Calculation Results:</h4>
                <pre>{calculationResult}</pre>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="controls">

        <button
          className="segr-manage-btn info"
          onClick={() => setShowEditModal(!showEditModal)}
        >
          {showEditModal ? "✖ Close" : "✎ Add / Edit DG Log"}
        </button>
      </div>
      {showEditModal && (
        <form className="daily-log-form" onSubmit={handleSubmit}>
          <label>
            Date:
            <input
              type="date"
              name="Date"
              value={form.Date || ""}
              onChange={(e) => handleDateChange(e.target.value)}
              required
            />
          </label>

          {inputFields.map((field) => (
            <label key={field}>
              {field}:
              <input
                type="number"
                step="any"
                name={field}
                value={form[field] || ""}
                onChange={handleChange}
                className={`${form[field] === "" || form[field] === undefined ? "input-missing" : ""} ${getFieldClass(field)}`}
              />
            </label>
          ))}

          <button className="submit-btn" type="submit">Save Entry</button>
        </form>
      )}

      <div>
        <h2>📝 {formatMonthName(selectedMonth)} Logs :</h2>
        <button className="download-btn" onClick={handleDownloadExcel}>⬇️ Download Excel</button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>DG-1 OPENING KWH</th>
              <th>DG-1 CLOSING KWH</th>
              <th>DG-1 KWH Generation</th>
              <th>DG-2 OPENING KWH</th>
              <th>DG-2 CLOSING KWH</th>
              <th>DG-2 KWH Generation</th>
              <th>EB-1 OPENING KWH</th>
              <th>EB-1 CLOSING KWH</th>
              <th>EB-1 KWH Consumption</th>
              <th>EB-2 OPENING KWH</th>
              <th>EB-2 CLOSING KWH</th>
              <th>EB-2 KWH Consumption</th>
              <th>DG-1 Run Min</th>
              <th>DG-2 Run Min</th>
              <th>DG-1 Fuel Opening</th>
              <th>DG-1 Fuel Closing</th>
              <th>DG-1 Fuel Filling</th>
              <th>DG-1 ON Load Consumption</th>
              <th>DG-1 OFF Load Consumption</th>
              <th>DG-1 Fuel Consumption</th>
              <th>DG-1 Hour Opening</th>
              <th>DG-1 Hour Closing</th>
              <th>DG-1 ON Load Hour</th>
              <th>DG-1 OFF Load Hour</th>
              <th>DG-1 Running Hrs</th>
              <th>DG-1 CPH</th>
              <th>DG-1 SEGR</th>
              <th>DG-2 Fuel Opening</th>
              <th>DG-2 Fuel Closing</th>
              <th>DG-2 Fuel Filling</th>
              <th>DG-2 ON Load Consumption</th>
              <th>DG-2 OFF Load Consumption</th>
              <th>DG-2 Fuel Consumption</th>
              <th>DG-2 Hour Opening</th>
              <th>DG-2 Hour Closing</th>
              <th>DG-2 ON Load Hour</th>
              <th>DG-2 OFF Load Hour</th>
              <th>DG-2 Running Hrs</th>
              <th>DG-2 CPH</th>
              <th>DG-2 SEGR</th>
              <th>Total DG KWH Generation</th>
              <th>Total EB KWH Reading</th>
              <th>Total KWH Consumption(EB+DG)</th>
              <th>Total Fuel Consumption</th>
              <th>Total DG Run Hours</th>
              <th>Site Running kW</th>
              {userData?.role === "Super Admin" && (
                <th>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {logs.map((entry) => {
              const calculated = calculateFields(entry);

              // thresholds
              let rowClass = "";
              if ((calculated["DG-1 CPH"] > 100 && calculated["DG-1 CPH"] < 80) || (calculated["DG-2 CPH"] > 100 && calculated["DG-2 CPH"] < 80)) {
                rowClass = "row-inefficient"; // 🔴 inefficient
              } else if ((calculated["DG-1 SEGR"] < 3 && calculated["DG-1 SEGR"] > 0) || (calculated["DG-2 SEGR"] < 3 && calculated["DG-2 SEGR"] > 0)) {
                rowClass = "row-warning"; // ⚠️ investigate
              } else if ((calculated["DG-1 OFF Load Consumption"] > 0 && calculated["DG-1 OFF Load Hour"] > 0) || (calculated["DG-2 OFF Load Consumption"] > 0 && calculated["DG-2 OFF Load Hour"] > 0)) {
                rowClass = "row-offload"; // ⚠️ investigate
              }
              return (
                <tr key={entry.id} className={rowClass} onClick={() => { setForm(entry); setShowEditModal(true) }}>
                  <td>{entry.Date}</td>
                  <td>{fmt(calculated["DG-1 KWH Opening"])}</td>
                  <td>{fmt(calculated["DG-1 KWH Closing"])}</td>
                  <td>{fmt(calculated["DG-1 KWH Generation"])}</td>
                  <td>{fmt(calculated["DG-2 KWH Opening"])}</td>
                  <td>{fmt(calculated["DG-2 KWH Closing"])}</td>
                  <td>{fmt(calculated["DG-2 KWH Generation"])}</td>
                  <td>{fmt(calculated["EB-1 KWH Opening"])}</td>
                  <td>{fmt(calculated["EB-1 KWH Closing"])}</td>
                  <td>{fmt(calculated["EB-1 KWH Generation"])}</td>
                  <td>{fmt(calculated["EB-2 KWH Opening"])}</td>
                  <td>{fmt(calculated["EB-2 KWH Closing"])}</td>
                  <td>{fmt(calculated["EB-2 KWH Generation"])}</td>
                  <td>{fmt(calculated["DG-1 Run Min"])}</td>
                  <td>{fmt(calculated["DG-2 Run Min"])}</td>
                  <td>{fmt(calculated["DG-1 Fuel Opening"])}</td>
                  <td>{fmt(calculated["DG-1 Fuel Closing"])}</td>
                  <td>{fmt(calculated["DG-1 Fuel Filling"] || 0)}</td>
                  <td>{fmt(calculated["DG-1 ON Load Consumption"] || 0)}</td>
                  <td>{fmt(calculated["DG-1 OFF Load Consumption"] || 0)}</td>
                  <td>{fmt(calculated["DG-1 Fuel Consumption"])}</td>
                  <td>{fmt1(calculated["DG-1 Hour Opening"])}</td>
                  <td>{fmt1(calculated["DG-1 Hour Closing"])}</td>
                  <td>{fmt1(calculated["DG-1 ON Load Hour"])}</td>
                  <td>{fmt1(calculated["DG-1 OFF Load Hour"])}</td>
                  <td>{fmt1(calculated["DG-1 Running Hrs"])}</td>
                  <td>{fmt(calculated["DG-1 CPH"])}</td>
                  <td>{fmt(calculated["DG-1 SEGR"])}</td>
                  <td>{fmt(calculated["DG-2 Fuel Opening"])}</td>
                  <td>{fmt(calculated["DG-2 Fuel Closing"])}</td>
                  <td>{fmt(calculated["DG-2 Fuel Filling"] || 0)}</td>
                  <td>{fmt(calculated["DG-2 ON Load Consumption"] || 0)}</td>
                  <td>{fmt(calculated["DG-2 OFF Load Consumption"] || 0)}</td>
                  <td>{fmt(calculated["DG-2 Fuel Consumption"])}</td>
                  <td>{fmt1(calculated["DG-2 Hour Opening"])}</td>
                  <td>{fmt1(calculated["DG-2 Hour Closing"])}</td>
                  <td>{fmt1(calculated["DG-2 ON Load Hour"])}</td>
                  <td>{fmt1(calculated["DG-2 OFF Load Hour"])}</td>
                  <td>{fmt1(calculated["DG-2 Running Hrs"])}</td>
                  <td>{fmt(calculated["DG-2 CPH"])}</td>
                  <td>{fmt(calculated["DG-2 SEGR"])}</td>
                  <td>{fmt(calculated["Total DG KWH"])}</td>
                  <td>{fmt(calculated["Total EB KWH"])}</td>
                  <td>{fmt(calculated["Total Unit Consumption"])}</td>
                  <td>{fmt(calculated["Total DG Fuel"])}</td>
                  <td>{fmt1(calculated["Total DG Hours"])}</td>
                  <td>{fmt(calculated["Total Unit Consumption"] / 24)}</td>

                  <td>
                    {userData?.role === "Super Admin" && (
                      <button onClick={() => handleDelete(entry.id)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DailyDGLog;
