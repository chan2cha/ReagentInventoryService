"use client";

import { Trash2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import {
  ORDER_IMAGE_ACCEPT,
  ORDER_IMAGE_MAX_BYTES,
  orderImageMetadataError
} from "@/domain/order-image";

function formatFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function imageErrorMessage(error: string) {
  if (error === "ORDER_IMAGE_SIZE_INVALID") return "3MB 이하의 이미지만 첨부할 수 있습니다.";
  if (error === "ORDER_IMAGE_NAME_INVALID") return "파일명이 올바르지 않거나 너무 깁니다.";
  return "JPG, PNG 또는 WebP 이미지만 첨부할 수 있습니다.";
}

export function OrderImageInput() {
  const inputId = `${useId()}-order-image`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  function clearFile() {
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.setCustomValidity("");
    }
    setSelectedFile(null);
    setErrorMessage("");
  }

  return (
    <section aria-labelledby={`${inputId}-label`} className="wide order-image-field">
      <div className="order-image-heading">
        <div>
          <strong id={`${inputId}-label`}>주문 이미지</strong>
          <span>선택 사항 · JPG, PNG, WebP · 최대 {ORDER_IMAGE_MAX_BYTES / 1024 / 1024}MB</span>
        </div>
        <button className="order-image-select-button" onClick={() => inputRef.current?.click()} type="button">
          <Upload aria-hidden="true" size={16} />
          {selectedFile ? "다시 선택" : "이미지 선택"}
        </button>
      </div>

      <input
        accept={ORDER_IMAGE_ACCEPT}
        aria-describedby={`${inputId}-message`}
        aria-label="주문 이미지 파일"
        className="visually-hidden"
        id={inputId}
        name="image"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;

          if (!file || file.size === 0) {
            clearFile();
            return;
          }

          const metadataError = orderImageMetadataError(file);
          if (metadataError) {
            const message = imageErrorMessage(metadataError);
            event.target.value = "";
            event.target.setCustomValidity(message);
            setSelectedFile(null);
            setErrorMessage(message);
            return;
          }

          event.target.setCustomValidity("");
          setSelectedFile(file);
          setErrorMessage("");
        }}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />

      <div className={`order-image-selection${errorMessage ? " has-error" : ""}`} id={`${inputId}-message`}>
        {selectedFile ? (
          <>
            <div>
              <strong>{selectedFile.name}</strong>
              <span>{formatFileSize(selectedFile.size)}</span>
            </div>
            <button aria-label={`${selectedFile.name} 첨부 제거`} onClick={clearFile} type="button">
              <Trash2 aria-hidden="true" size={16} />
              제거
            </button>
          </>
        ) : errorMessage ? (
          <>
            <p role="alert">{errorMessage}</p>
            <button onClick={clearFile} type="button">첨부 안 함</button>
          </>
        ) : (
          <p>주문서, 요청서 등 참고 이미지를 1개 첨부할 수 있습니다.</p>
        )}
      </div>
    </section>
  );
}
