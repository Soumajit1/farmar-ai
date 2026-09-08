(() => {
"use strict";

const API = "http://localhost:5000/api/fpo";
const fpoId = Number(localStorage.getItem("user_id") || localStorage.getItem("userId") || 3);

const demo = {
  transactions: [
    {id:"TXN-1108",transaction_date:"2026-09-02",farmer_name:"Anil Sharma",buyer_name:"AgriCorp Foods",crop_name:"Wheat",quantity:850,unit:"kg",amount:229500,status:"completed"},
    {id:"TXN-1107",transaction_date:"2026-09-01",farmer_name:"Ramesh Kumar",buyer_name:"Fresh Foods Ltd",crop_name:"Rice",quantity:620,unit:"kg",amount:210800,status:"completed"},
    {id:"TXN-1106",transaction_date:"2026-08-30",farmer_name:"Mukesh Singh",buyer_name:"Green Mart",crop_name:"Potato",quantity:410,unit:"kg",amount:77900,status:"completed"}
  ],
  members: [
    {id:101,name:"Anil Sharma",email:"anil@example.com",total_listings:8,available_quantity:620},
    {id:102,name:"Mukesh Singh",email:"mukesh@example.com",total_listings:5,available_quantity:410}
  ],
  inventory: [
    {crop_name:"Wheat",unit:"kg",farmer_count:18,total_quantity:4260,available_quantity:3140,average_price:27},
    {crop_name:"Rice",unit:"kg",farmer_count:15,total_quantity:3820,available_quantity:2510,average_price:34}
  ],
  buyers: [
    {buyer_id:201,buyer_name:"AgriCorp Foods",buyer_email:"procurement@agricorp.example",total_offers:14,pending_offers:2,accepted_offers:10,total_purchase_value:1250000},
    {buyer_id:202,buyer_name:"Fresh Foods Ltd",buyer_email:"buy@freshfoods.example",total_offers:9,pending_offers:1,accepted_offers:7,total_purchase_value:452000}
  ]
};

const money = n => "₹" + Number(n || 0).toLocaleString("en-IN",{maximumFractionDigits:2});
const num = n => Number(n || 0).toLocaleString("en-IN",{maximumFractionDigits:2});

async function get(path){
  const r=await fetch(`${API}${path}`);
  if(!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
  return r.json();
}

function renderTransactions(list){
  const body=document.querySelector("#transactionTableBody");
  if(!body)return;
  body.innerHTML=(list.length?list:demo.transactions).map(t=>`
    <tr>
      <td>#${t.id}</td>
      <td>${new Date(t.transaction_date).toLocaleDateString("en-IN")}</td>
      <td>${t.farmer_name || "-"}</td>
      <td>${t.buyer_name || "-"}</td>
      <td>${t.crop_name || "-"}</td>
      <td>${num(t.quantity)} ${t.unit || ""}</td>
      <td><strong>${money(t.amount)}</strong></td>
      <td><span class="status-badge ${t.status}">${t.status}</span></td>
    </tr>`).join("");
}

async function loadTransactions(){
  try{
    const data=await get(`/transactions/${fpoId}`);
    const s=data.statistics || {};
    document.querySelector("#totalRevenue")?.replaceChildren(document.createTextNode(money(s.totalRevenue)));
    document.querySelector("#completedTransactions")?.replaceChildren(document.createTextNode(num(s.completed)));
    document.querySelector("#pendingTransactions")?.replaceChildren(document.createTextNode(num(s.pending)));
    renderTransactions(data.transactions || []);
  }catch(e){
    console.warn("FPO API unavailable; using local fallback:",e.message);
    renderTransactions(demo.transactions);
  }
}

async function loadMembers(){
  try{
    const data=await get(`/members/${fpoId}`);
    return data.members || demo.members;
  }catch{return demo.members;}
}

async function loadInventory(){
  try{
    const data=await get(`/inventory/${fpoId}`);
    return data.inventory || demo.inventory;
  }catch{return demo.inventory;}
}

async function loadBuyers(){
  try{
    const data=await get(`/buyers/${fpoId}`);
    return data.buyers || demo.buyers;
  }catch{return demo.buyers;}
}

window.FPO = {
  loadTransactions,
  loadMembers,
  loadInventory,
  loadBuyers
};

document.addEventListener("DOMContentLoaded",()=>{
  if(location.pathname.toLowerCase().includes("fpo-transactions")){
    loadTransactions();
  }
});
})();