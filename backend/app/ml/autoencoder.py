import os
import time
from typing import Dict, Any, Tuple, List, Optional
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader
from sklearn.preprocessing import RobustScaler
import joblib
from app.core.config import settings

class DenoisingAutoencoderNet(nn.Module):
    def __init__(
        self,
        input_dim: int = 30,
        bottleneck_dim: int = 8,
        dropout_rate: float = 0.1,
        noise_std: float = 0.05
    ):
        super().__init__()
        self.noise_std = noise_std
        
        # Encoder: 30 -> 64 -> 16 -> 8
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.Dropout(dropout_rate),
            
            nn.Linear(64, 16),
            nn.BatchNorm1d(16),
            nn.ReLU(),
            nn.Dropout(dropout_rate),
            
            nn.Linear(16, bottleneck_dim),
            nn.BatchNorm1d(bottleneck_dim),
            nn.ReLU()
        )
        
        # Decoder: 8 -> 16 -> 64 -> 30
        self.decoder = nn.Sequential(
            nn.Linear(bottleneck_dim, 16),
            nn.BatchNorm1d(16),
            nn.ReLU(),
            nn.Dropout(dropout_rate),
            
            nn.Linear(16, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.Dropout(dropout_rate),
            
            nn.Linear(64, input_dim)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if self.training and self.noise_std > 0.0:
            noise = torch.randn_like(x) * self.noise_std
            corrupted = x + noise
        else:
            corrupted = x
        latent = self.encoder(corrupted)
        reconstructed = self.decoder(latent)
        return reconstructed

class DenoisingAutoencoderDetector:
    def __init__(
        self,
        input_dim: int = settings.DAE_INPUT_DIM,
        bottleneck_dim: int = settings.DAE_LATENT_DIM,
        dropout_rate: float = settings.DAE_DROPOUT,
        noise_std: float = settings.DAE_NOISE_STD,
        lr: float = settings.DAE_LEARNING_RATE,
        batch_size: int = settings.DAE_BATCH_SIZE,
        max_epochs: int = settings.DAE_MAX_EPOCHS,
        patience: int = settings.DAE_PATIENCE
    ):
        self.input_dim = input_dim
        self.bottleneck_dim = bottleneck_dim
        self.dropout_rate = dropout_rate
        self.noise_std = noise_std
        self.lr = lr
        self.batch_size = batch_size
        self.max_epochs = max_epochs
        self.patience = patience
        
        self.device = torch.device("cpu")
        self.model = DenoisingAutoencoderNet(
            input_dim=input_dim,
            bottleneck_dim=bottleneck_dim,
            dropout_rate=dropout_rate,
            noise_std=noise_std
        ).to(self.device)
        
        self.scaler = RobustScaler()
        self.is_fitted = False
        self.history: Dict[str, List[float]] = {"train_loss": [], "val_loss": []}
        self.metadata: Dict[str, Any] = {}

    def fit(
        self,
        X_train: np.ndarray,
        X_val: Optional[np.ndarray] = None,
        feature_names: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Fits RobustScaler on X_train only, then trains the DAE with Adam and early stopping.
        """
        start_time = time.time()
        
        # Fit scaler strictly on training split
        X_train_scaled = self.scaler.fit_transform(X_train)
        
        train_tensor = torch.tensor(X_train_scaled, dtype=torch.float32)
        train_loader = DataLoader(
            TensorDataset(train_tensor, train_tensor),
            batch_size=self.batch_size,
            shuffle=True
        )
        
        val_loader = None
        if X_val is not None:
            X_val_scaled = self.scaler.transform(X_val)
            val_tensor = torch.tensor(X_val_scaled, dtype=torch.float32)
            val_loader = DataLoader(
                TensorDataset(val_tensor, val_tensor),
                batch_size=self.batch_size,
                shuffle=False
            )

        optimizer = torch.optim.Adam(self.model.parameters(), lr=self.lr)
        criterion = nn.MSELoss()
        
        best_val_loss = float("inf")
        patience_counter = 0
        best_state_dict = None

        self.history = {"train_loss": [], "val_loss": []}

        for epoch in range(1, self.max_epochs + 1):
            self.model.train()
            total_train_loss = 0.0
            for batch_x, clean_target in train_loader:
                batch_x = batch_x.to(self.device)
                clean_target = clean_target.to(self.device)
                
                optimizer.zero_grad()
                output = self.model(batch_x)
                loss = criterion(output, clean_target)
                loss.backward()
                optimizer.step()
                total_train_loss += loss.item() * len(batch_x)
                
            avg_train_loss = total_train_loss / len(train_tensor)
            self.history["train_loss"].append(round(avg_train_loss, 6))

            # Validation evaluation
            if val_loader is not None:
                self.model.eval()
                total_val_loss = 0.0
                with torch.no_grad():
                    for batch_val, clean_val in val_loader:
                        batch_val = batch_val.to(self.device)
                        clean_val = clean_val.to(self.device)
                        recon = self.model(batch_val)
                        v_loss = criterion(recon, clean_val)
                        total_val_loss += v_loss.item() * len(batch_val)
                avg_val_loss = total_val_loss / len(val_tensor)
                self.history["val_loss"].append(round(avg_val_loss, 6))

                # Early stopping check
                if avg_val_loss < best_val_loss:
                    best_val_loss = avg_val_loss
                    best_state_dict = {k: v.cpu().clone() for k, v in self.model.state_dict().items()}
                    patience_counter = 0
                else:
                    patience_counter += 1
                    if patience_counter >= self.patience:
                        break
            else:
                best_state_dict = {k: v.cpu().clone() for k, v in self.model.state_dict().items()}

        if best_state_dict is not None:
            self.model.load_state_dict(best_state_dict)

        self.is_fitted = True
        elapsed = time.time() - start_time

        self.metadata = {
            "model_type": "DenoisingAutoencoder",
            "architecture": f"{self.input_dim}->64->16->{self.bottleneck_dim}->16->64->{self.input_dim}",
            "bottleneck_dim": self.bottleneck_dim,
            "dropout_rate": self.dropout_rate,
            "noise_std": self.noise_std,
            "learning_rate": self.lr,
            "batch_size": self.batch_size,
            "epochs_run": len(self.history["train_loss"]),
            "early_stopped": patience_counter >= self.patience,
            "best_val_loss": round(best_val_loss, 6) if val_loader is not None else None,
            "training_samples": int(X_train.shape[0]),
            "feature_names": feature_names or [],
            "training_time_seconds": round(elapsed, 4),
            "device": str(self.device),
            "timestamp": time.time()
        }
        return self.metadata

    def score(self, X: np.ndarray) -> np.ndarray:
        """
        Computes reconstruction error (mean squared residual across features) for each sample.
        Larger value indicates greater anomaly.
        """
        if not self.is_fitted:
            raise RuntimeError("Autoencoder is not fitted.")
        
        X_scaled = self.scaler.transform(X)
        self.model.eval()
        with torch.no_grad():
            tensor_x = torch.tensor(X_scaled, dtype=torch.float32).to(self.device)
            recon = self.model(tensor_x)
            squared_diff = (tensor_x - recon) ** 2
            # Mean squared error per sample: (1/D) * sum((x_j - x_hat_j)^2)
            recon_errors = squared_diff.mean(dim=1).cpu().numpy()
        return recon_errors

    def feature_residuals(self, X: np.ndarray) -> np.ndarray:
        """
        Computes feature-wise squared residuals: (x_j - x_hat_j)^2 for explainability.
        Returns array of shape (N, D).
        """
        if not self.is_fitted:
            raise RuntimeError("Autoencoder is not fitted.")
        
        X_scaled = self.scaler.transform(X)
        self.model.eval()
        with torch.no_grad():
            tensor_x = torch.tensor(X_scaled, dtype=torch.float32).to(self.device)
            recon = self.model(tensor_x)
            diff = (tensor_x - recon) ** 2
            residuals = diff.cpu().numpy()
        return residuals

    def save(self, filepath: str):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        data = {
            "model_state_dict": self.model.cpu().state_dict(),
            "scaler": self.scaler,
            "metadata": self.metadata,
            "history": self.history,
            "config": {
                "input_dim": self.input_dim,
                "bottleneck_dim": self.bottleneck_dim,
                "dropout_rate": self.dropout_rate,
                "noise_std": self.noise_std,
                "lr": self.lr,
                "batch_size": self.batch_size,
                "max_epochs": self.max_epochs,
                "patience": self.patience
            },
            "is_fitted": self.is_fitted
        }
        torch.save(data, filepath)
        self.model.to(self.device)

    @classmethod
    def load(cls, filepath: str) -> "DenoisingAutoencoderDetector":
        data = torch.load(filepath, map_location="cpu")
        cfg = data["config"]
        detector = cls(**cfg)
        detector.scaler = data["scaler"]
        detector.model.load_state_dict(data["model_state_dict"])
        detector.model.to(detector.device)
        detector.metadata = data.get("metadata", {})
        detector.history = data.get("history", {})
        detector.is_fitted = data.get("is_fitted", True)
        return detector
