import asyncio
import json
import time
import uuid
from typing import Dict, Any, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import numpy as np

from app.ml.pipeline import pipeline
from app.ml.dataset import FEATURE_NAMES

router = APIRouter()

class SimulatorManager:
    def __init__(self):
        self.is_running = False
        self.tps = 2.0  # transactions per second
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                self.disconnect(connection)

simulator_manager = SimulatorManager()

@router.websocket("/stream")
async def simulator_stream(websocket: WebSocket):
    await simulator_manager.connect(websocket)
    rng = np.random.default_rng()
    try:
        while True:
            # Generate synthetic transaction
            # 5% chance of anomalous pattern for live demo engagement
            is_anomaly = rng.random() < 0.08
            
            v_vals = rng.normal(0, 1.0, 28)
            if is_anomaly:
                v_vals[13] -= rng.normal(6.0, 1.5)  # V14
                v_vals[11] -= rng.normal(4.5, 1.2)  # V12
                v_vals[3] += rng.normal(3.8, 1.0)   # V4
                amt = float(rng.choice([1.00, 349.00, 999.00, 1500.00]))
            else:
                amt = float(np.round(rng.lognormal(2.5, 1.2), 2))

            tx_data = {
                "tx_id": f"sim_{int(time.time()*1000)}_{uuid.uuid4().hex[:4]}",
                "Time": float(time.time() % 172800),
                "Amount": amt
            }
            for i in range(1, 29):
                tx_data[f"V{i}"] = float(v_vals[i - 1])

            # Real pipeline inference
            if pipeline.is_ready:
                res = pipeline.predict_transaction(tx_data)
            else:
                res = {
                    "fused_score": 0.1,
                    "dai": 0.8,
                    "decision_tier": "APPROVE",
                    "agreement_gate_triggered": False,
                    "latency_ms": 5.0
                }

            event_payload = {
                "type": "TRANSACTION_EVENT",
                "timestamp": time.time(),
                "tx_id": tx_data["tx_id"],
                "amount": amt,
                "is_synthetic_injection": is_anomaly,
                "raw_score_if": res.get("s_if", 0.0),
                "raw_score_ae": res.get("s_ae", 0.0),
                "rank_if": res.get("r_if", 0.0),
                "rank_ae": res.get("r_ae", 0.0),
                "dai": res.get("dai", 0.0),
                "fused_score": res.get("fused_score", 0.0),
                "decision_tier": res.get("decision_tier", "APPROVE"),
                "agreement_gate_triggered": res.get("agreement_gate_triggered", False),
                "latency_ms": res.get("latency_ms", 5.0)
            }

            await websocket.send_text(json.dumps(event_payload))
            
            # Rate control: sleep based on tps
            delay = 1.0 / max(0.5, simulator_manager.tps)
            await asyncio.sleep(delay)

    except WebSocketDisconnect:
        simulator_manager.disconnect(websocket)
    except Exception:
        simulator_manager.disconnect(websocket)

@router.post("/config")
async def configure_simulator(tps: float = 2.0):
    simulator_manager.tps = min(20.0, max(0.2, tps))
    return {"status": "ok", "configured_tps": simulator_manager.tps}
