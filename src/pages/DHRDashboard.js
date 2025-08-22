// src/pages/DHRDashboard.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { format, parseJSON } from "date-fns";
import "../assets/DHRStyle.css";

// Import Recharts components
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export default function DHRDashboard({ userData }) {
  const userName = userData?.name;
  const userRole = userData?.role;
  const userSite = userData?.site;
  const userDesignation = userData?.designation;

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const today = new Date().toISOString().split("T")[0];
  const [filterDate, setFilterDate] = useState(today);
  const [filterSite, setFilterSite] = useState("");
  const [selectedTxt, setSelectedTxt] = useState("");
  const [showModal, setShowModal] = useState(false);


  // Add these state declarations with your other useState declarations at the top of your component
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [dgCapacity, setDgCapacity] = useState("");
  const [dgKw, setDgKw] = useState("");
  const [dgHmr, setDgHmr] = useState("");
  const [calculationResult, setCalculationResult] = useState("");
  const [selectedCapacity, setSelectedCapacity] = useState("");


  const navigate = useNavigate();

  // Define this with your other constants (before the component)
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

  useEffect(() => {
    const fetchInstruction = async () => {
      const docRef = doc(db, "config", "dhr_dashboard_instruction");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setInstructionText(docSnap.data().text || "");
        setEditText(docSnap.data().text || "");
      }
    };
    fetchInstruction();
  }, []);

  useEffect(() => {
    const dhrRef = collection(db, "dhr_reports");
    const q = query(dhrRef, orderBy("isoDate", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let data = [];
        snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
        setReports(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching DHR reports:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const formatFilterDate = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return "";
    return `${parts[2]}.${parts[1]}.${parts[0]}`; // dd.MM.yyyy
  };

  const filteredReports = reports.filter((r) => {
    const formattedFilterDate = formatFilterDate(filterDate);
    return (
      (filterDate ? r.date === formattedFilterDate : true) &&
      (filterSite
        ? r.siteName?.toLowerCase().includes(filterSite.toLowerCase())
        : true)
    );
  });

  // --- Summary Stats Calculations ---

  // Sum dieselAvailable (convert to number safely)
  const totalDieselAvailable = filteredReports.reduce((acc, r) => {
    const val = parseFloat(r.dieselAvailable);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // Total Fault count (assuming faultDetails !=== 'No' or similar)
  const totalFault = filteredReports.reduce((acc, r) => {
    return acc + (r.faultDetails?.toLowerCase() === "Fault" ? 1 : 0);
  }, 0);

  // Total DG run hours sum
  const totalDgRunHrs = filteredReports.reduce((acc, r) => {
    const val = parseFloat(r.dgRunHrsYesterday);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // Total EB run hours sum
  const totalEbRunHrs = filteredReports.reduce((acc, r) => {
    const val = parseFloat(r.ebRunHrsYesterday);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // Prepare chart data grouped by siteName (sum dieselAvailable & dgRunHrs)
  // Could limit to top N or all sites
  const siteDataMap = {};
  filteredReports.forEach((r) => {
    if (!r.siteName) return;
    if (!siteDataMap[r.siteName]) {
      siteDataMap[r.siteName] = {
        siteName: r.siteName,
        dieselAvailable: 0,
        dgRunHrsYesterday: 0,
        ebRunHrsYesterday: 0,
        faultDetails: "",
      };
    }
    const dieselVal = parseFloat(r.dieselAvailable);
    const dgVal = parseFloat(r.dgRunHrsYesterday);
    const ebVal = parseFloat(r.ebRunHrsYesterday);
    const fault = r.faultDetails;
    siteDataMap[r.siteName].dieselAvailable += isNaN(dieselVal) ? 0 : dieselVal;
    siteDataMap[r.siteName].dgRunHrsYesterday += isNaN(dgVal) ? 0 : dgVal;
    siteDataMap[r.siteName].ebRunHrsYesterday += isNaN(ebVal) ? 0 : ebVal;
    siteDataMap[r.siteName].faultDetails += isNaN(fault) ? r.faultDetails : fault;
  });

  const chartData = Object.values(siteDataMap);

  const generateTXT = (r) => {
    return `Date: ${r.date}
Region: ${r.region}
Circle: ${r.circle}
Site Name: ${r.siteName}
Diesel Available (Ltr's): ${r.dieselAvailable}
DG run hrs yesterday: ${r.dgRunHrsYesterday}
EB run hrs yesterday: ${r.ebRunHrsYesterday}
EB Status: ${r.ebStatus}
DG Status: ${r.dgStatus}
SMPS Status: ${r.smpsStatus}
UPS Status: ${r.upsStatus}
PAC Status: ${r.pacStatus}
CRV Status: ${r.crvStatus}
Major Activity Planned for the day: ${r.majorActivity}
Inhouse PM: ${r.inhousePM}
Fault details if any: ${r.faultDetails}
`;
  };

  const shareWhatsApp = (txt) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  const shareTelegram = (txt) => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(txt)}`, "_blank");
  };

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredReports);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DHR Data");
    XLSX.writeFile(wb, `DHR_Data_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const downloadTXT = () => {
    const txt = filteredReports.map(generateTXT).join("\n\n----------------\n\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `DHR_Data_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
  };

  if (loading) {
    return <p className="loading">Loading DHR data...</p>;
  }

  

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
    <div className="dhr-dashboard-container">
      <h1 className="dashboard-header">
        <strong>⚡WB DHR Dashboard</strong>
      </h1>

      {/* Summary Stats Panel */}
      <div style={{ color: "#6b7280", fontSize: 15 }}>📌 Date: {filterDate}</div>
      <div className="summary-stats chart-container">
        <div className="stat-card">
          <h3>Total Diesel Available (Ltrs)</h3>
          <p>{totalDieselAvailable.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <h3>Total Yesterday DG Run Hours</h3>
          <p>{totalDgRunHrs.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <h3>Total Yesterday EB Run Hours</h3>
          <p>{totalEbRunHrs.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <h3>Total Fault Count</h3>
          <p>{totalFault}</p>
        </div>
      </div>
      <div style={{ color: "#6b7280", fontSize: 12 }}>"<strong>Click</strong>'' The Below 👇<strong>"CPH/SEGR Manager"</strong> Button <strong>||</strong> You can calculate DG <strong>load %, SEGR, CPH</strong> as per <strong>"Cummins Disign CHP"</strong> by giving only Three Inputs <strong>(Select DG Capacity - Generate kW - DG Run Hrs)</strong> </div>
      <button 
        className="segr-manage-btn" 
        onClick={() => setShowFuelModal(true)}
      >
        💥 CPH/SEGR Manager
      </button>
      
      {showFuelModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '600px'}}>
            <h2>Cummins DG CPH/SEGR Monitor</h2>
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

      {/* Filters */}
      <div className="dhr-filters">
        <div style={{ color: "#6b7280", fontSize: 12 }}>Filter By Date</div>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
        />
        <div style={{ color: "#6b7280", fontSize: 12 }}>Filter By Site</div>
        <input
          type="text"
          placeholder="Search by site"
          value={filterSite}
          onChange={(e) => setFilterSite(e.target.value)}
        />
        <button className="btn-secondary pm-manage-btn" onClick={() => navigate("/create-dhr")}>
          ➕ Create / Edit {userData?.site} DHR(S)
        </button>
        <span className="separator">|</span>
        <button className="pm-manage-btn" onClick={() => navigate("/create-big-dhr")}>
          ➕ Create / Edit {userData?.site} DHR(B)
        </button>
        <span className="separator">|</span>
        <button className="download-btn" onClick={downloadExcel}>
          ⬇️ Download Excel
        </button>
        <span className="separator">|</span>
        <button className="download-btn" onClick={downloadTXT}>
          ⬇️ Download TXT
        </button>
      </div>


      {/* Chart */}
      <div className="chart-container">
        <h3>Diesel Available & DG / EB Run Hours by Site</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 40, left: 20, bottom: 20 }}>
            <CartesianGrid stroke="#f5f5f5" />
            <XAxis dataKey="siteName" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="dieselAvailable" barSize={40} fill="#413ea0" name="Diesel Available (L)" />
            <Line type="monotone" dataKey="dgRunHrsYesterday" stroke="#ff7300" name="DG Run Yesterday (Hrs)" />
            <Line type="monotone" dataKey="ebRunHrsYesterday" stroke="#387908" name="EB Run Yesterday (Hrs)" />
            <Line type="monotone" dataKey="faultDetails" stroke="#f1592aff" name="Fault Details" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Notice Board */}
      <div className="instruction-tab">
        <h2 className="noticeboard-header">📌 Notice Board </h2>
        {/* <h3 className="dashboard-header">📘 App Overview </h3> */}
        {isEditing ? (
          <>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={5}
              className="dashboard-instruction-panel"
            />
            <div className="flex gap-2">
              <button
                className="bg-blue-600 text-white px-3 py-1 rounded"
                onClick={async () => {
                  const docRef = doc(db, "config", "dhr_dashboard_instruction");
                  await setDoc(docRef, { text: editText });
                  setInstructionText(editText);
                  setIsEditing(false);
                }}
              >
                Save
              </button>
              <button
                className="bg-gray-400 text-white px-3 py-1 rounded"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="dashboard-instruction-panel">
              {instructionText || "No instructions available."}
            </p>
            {["Admin", "Super Admin"].includes(userRole) && (
              <button
                className="text-blue-600 underline"
                onClick={() => setIsEditing(true)}
              >
                Edit Instruction
              </button>
            )}
          </>
        )}
        <h6 style={{ marginLeft: "90%" }}>Thanks & Regards @Suman Adhikari</h6>
      </div>

      {/* Data Table */}
      {filteredReports.length === 0 ? (
        <p>No DHR records found.</p>
      ) : (
        <table className="dhr-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Region</th>
              <th>Circle</th>
              <th>Site Name</th>
              <th>Diesel Available</th>
              <th>DG Run Hrs Yesterday</th>
              <th>EB Run Hrs Yesterday</th>
              <th>EB Status</th>
              <th>DG Status</th>
              <th>SMPS</th>
              <th>UPS</th>
              <th>PAC</th>
              <th>CRV</th>
              <th>Major Activity</th>
              <th>Inhouse PM</th>
              <th>Fault Details</th>
              <th>Last Edited By</th>
              <th>Last Edit Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.map((r, i) => (
              <tr key={i}>
                <td>{r.date}</td>
                <td>{r.region}</td>
                <td>{r.circle}</td>
                <td>{r.siteName}</td>
                <td>{r.dieselAvailable}</td>
                <td>{r.dgRunHrsYesterday}</td>
                <td>{r.ebRunHrsYesterday}</td>
                <td>{r.ebStatus}</td>
                <td>{r.dgStatus}</td>
                <td>{r.smpsStatus}</td>
                <td>{r.upsStatus}</td>
                <td>{r.pacStatus}</td>
                <td>{r.crvStatus}</td>
                <td>{r.majorActivity}</td>
                <td>{r.inhousePM}</td>
                <td>{r.faultDetails}</td>
                <td>{r.lastEditor || "Unknown"}</td>
                <td>
                  {r.lastEditTime
                    ? format(new Date(r.lastEditTime), "dd.MM.yyyy HH:mm")
                    : "N/A"}
                </td>
                <td>
                  <button
                    className="view-btn"
                    onClick={() => {
                      setSelectedTxt(generateTXT(r));
                      setShowModal(true);
                    }}
                  >
                    👁 View
                  </button>
                  <button
                    className="share-btn"
                    onClick={() => shareWhatsApp(generateTXT(r))}
                    title="Share WhatsApp"
                  >
                    ➤What'sApp
                  </button>
                  <button
                    className="share-btn"
                    onClick={() => shareTelegram(generateTXT(r))}
                    title="Share Telegram"
                  >
                    ➤Telegram
                  </button>
                  {showModal && (
                    <div className="modal-overlay">
                      <div className="modal-content">
                        <pre>{selectedTxt}</pre>
                        <button
                          onClick={() => setShowModal(false)}
                          className="close-btn"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      
    </div>
  );
}
