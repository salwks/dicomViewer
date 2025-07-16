import React from "react";
import { X } from "lucide-react";

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
}

interface DependencyInfo {
  name: string;
  version: string;
  license: string;
  type: "dependency" | "devDependency";
}

// 공통 버튼 스타일 - 브라우저 간 통일된 디자인
const commonButtonStyle = {
  background: "transparent",
  border: "none",
  padding: "0",
  margin: "0",
  cursor: "pointer",
  outline: "none",
  WebkitAppearance: "none" as const,
  MozAppearance: "none" as const,
  appearance: "none" as const,
  boxSizing: "border-box" as const,
  fontFamily: "inherit",
  fontSize: "inherit",
  lineHeight: "inherit",
};

// package.json에서 dependencies 정보 추출 (실제 프로젝트에서는 license 정보가 별도로 필요)
const getDependencies = (): DependencyInfo[] => {
  const dependencies: DependencyInfo[] = [
    // Main dependencies
    {
      name: "@cornerstonejs/core",
      version: "^1.77.9",
      license: "MIT",
      type: "dependency",
    },
    {
      name: "@cornerstonejs/dicom-image-loader",
      version: "^1.77.9",
      license: "MIT",
      type: "dependency",
    },
    {
      name: "@cornerstonejs/nifti-volume-loader",
      version: "^1.77.9",
      license: "MIT",
      type: "dependency",
    },
    {
      name: "@cornerstonejs/streaming-image-volume-loader",
      version: "^1.77.9",
      license: "MIT",
      type: "dependency",
    },
    {
      name: "@cornerstonejs/tools",
      version: "^1.77.9",
      license: "MIT",
      type: "dependency",
    },
    {
      name: "@types/crypto-js",
      version: "^4.2.2",
      license: "MIT",
      type: "dependency",
    },
    {
      name: "crypto-js",
      version: "^4.2.0",
      license: "MIT",
      type: "dependency",
    },
    { name: "dcmjs", version: "^0.43.0", license: "MIT", type: "dependency" },
    {
      name: "dicom-parser",
      version: "^1.8.21",
      license: "MIT",
      type: "dependency",
    },
    {
      name: "dompurify",
      version: "^3.2.6",
      license: "Apache-2.0 OR MPL-2.0",
      type: "dependency",
    },
    {
      name: "lucide-react",
      version: "^0.408.0",
      license: "ISC",
      type: "dependency",
    },
    { name: "react", version: "^18.2.0", license: "MIT", type: "dependency" },
    {
      name: "react-dom",
      version: "^18.2.0",
      license: "MIT",
      type: "dependency",
    },
    { name: "uuid", version: "^10.0.0", license: "MIT", type: "dependency" },
    { name: "zustand", version: "^4.4.7", license: "MIT", type: "dependency" },

    // Dev dependencies
    {
      name: "@types/dompurify",
      version: "^3.0.5",
      license: "MIT",
      type: "devDependency",
    },
    {
      name: "@types/node",
      version: "^24.0.13",
      license: "MIT",
      type: "devDependency",
    },
    {
      name: "@types/react",
      version: "^19.1.8",
      license: "MIT",
      type: "devDependency",
    },
    {
      name: "@types/react-dom",
      version: "^19.1.6",
      license: "MIT",
      type: "devDependency",
    },
    {
      name: "@types/uuid",
      version: "^10.0.0",
      license: "MIT",
      type: "devDependency",
    },
    {
      name: "@typescript-eslint/eslint-plugin",
      version: "^8.37.0",
      license: "MIT",
      type: "devDependency",
    },
    {
      name: "@typescript-eslint/parser",
      version: "^8.37.0",
      license: "MIT",
      type: "devDependency",
    },
    {
      name: "@vitejs/plugin-react",
      version: "^4.2.1",
      license: "MIT",
      type: "devDependency",
    },
    {
      name: "audit-ci",
      version: "^7.1.0",
      license: "Apache-2.0",
      type: "devDependency",
    },
    {
      name: "eslint-plugin-security",
      version: "^3.0.1",
      license: "Apache-2.0",
      type: "devDependency",
    },
    {
      name: "ts-node",
      version: "^10.9.2",
      license: "MIT",
      type: "devDependency",
    },
    {
      name: "typescript",
      version: "^5.2.2",
      license: "Apache-2.0",
      type: "devDependency",
    },
    { name: "vite", version: "^5.2.0", license: "MIT", type: "devDependency" },
    {
      name: "vite-plugin-csp",
      version: "^1.1.2",
      license: "MIT",
      type: "devDependency",
    },
    {
      name: "vite-plugin-static-copy",
      version: "^3.1.1",
      license: "MIT",
      type: "devDependency",
    },
    {
      name: "vite-plugin-top-level-await",
      version: "^1.5.0",
      license: "MIT",
      type: "devDependency",
    },
    {
      name: "vite-plugin-wasm",
      version: "^3.5.0",
      license: "MIT",
      type: "devDependency",
    },
  ];

  return dependencies.sort((a, b) => a.name.localeCompare(b.name));
};

export const LicenseModal: React.FC<LicenseModalProps> = ({
  isOpen,
  onClose,
  inline = false,
}) => {
  console.log("🔥 LicenseModal 렌더됨, isOpen:", isOpen, "inline:", inline);

  if (!isOpen) {
    console.log("🔥 LicenseModal isOpen이 false여서 null 반환");
    return null;
  }

  const dependencies = getDependencies();

  const mainDependencies = dependencies.filter(
    (dep) => dep.type === "dependency"
  );
  const devDependencies = dependencies.filter(
    (dep) => dep.type === "devDependency"
  );

  // 스크롤바 스타일링을 위한 CSS
  const scrollContainerStyle = `
    .license-scroll-container {
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: thin;
      scrollbar-color: #4a5568 #2d3748;
    }
    .license-scroll-container::-webkit-scrollbar {
      width: 8px;
    }
    .license-scroll-container::-webkit-scrollbar-track {
      background: #2d3748;
      border-radius: 4px;
    }
    .license-scroll-container::-webkit-scrollbar-thumb {
      background: #4a5568;
      border-radius: 4px;
    }
    .license-scroll-container::-webkit-scrollbar-thumb:hover {
      background: #718096;
    }
  `;

  const modalContent = (
    <>
      {/* 스크롤바 스타일 추가 */}
      <style>{scrollContainerStyle}</style>

      <div
        className="flex flex-col"
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#2d2d2d",
          color: "#ffffff",
          padding: "24px",
        }}
      >
        {/* 모달 헤더 */}
        <div
          className="border-b"
          style={{
            borderColor: "#374151",
            paddingBottom: "12px",
            marginBottom: "16px",
            position: "relative",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                color: "#ffffff",
                margin: 0,
              }}
            >
              Clarity
            </h2>
          </div>
          <div style={{ marginTop: "8px" }}>
            <p style={{ fontSize: "14px", color: "#d1d5db", margin: 0 }}>
              DICOM Medical Image Viewer
            </p>
            <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
              Created by stra2003@gmail.com
            </p>
            <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
              Version 0.1.0 - Alpha Release
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors"
            style={{
              ...commonButtonStyle,
              position: "absolute",
              top: "0",
              right: "0",
              color: "#9ca3af",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#374151";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            title="모달 닫기"
          >
            <X size={20} />
          </button>
        </div>

        {/* 라이브러리 목록 - 스크롤 가능 */}
        <div
          className="flex-1 license-scroll-container"
          style={{
            height: "calc(100% - 180px)",
            minHeight: "200px",
          }}
        >
          {/* 메인 Dependencies */}
          {mainDependencies.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#ffffff",
                  marginBottom: "12px",
                }}
              >
                Runtime Dependencies ({mainDependencies.length})
              </h3>
              <div className="grid gap-2">
                {mainDependencies.map((dep) => (
                  <div
                    key={dep.name}
                    className="p-3 rounded-lg border"
                    style={{
                      backgroundColor: "#2d2d2d",
                      borderColor: "#4a5568",
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4
                          style={{
                            fontSize: "10px",
                            fontWeight: "500",
                            color: "#ffffff",
                            margin: 0,
                          }}
                        >
                          {dep.name}
                        </h4>
                        <p
                          style={{
                            fontSize: "10px",
                            color: "#9ca3af",
                            margin: 0,
                          }}
                        >
                          Version: {dep.version}
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: "500",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor:
                            dep.license === "MIT" ? "#065f46" : "#7c2d12",
                          color: dep.license === "MIT" ? "#10b981" : "#f97316",
                        }}
                      >
                        {dep.license}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dev Dependencies */}
          {devDependencies.length > 0 && (
            <div>
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#ffffff",
                  marginBottom: "12px",
                  marginTop: "24px",
                  paddingTop: "16px",
                  borderTop: "1px solid #374151",
                }}
              >
                Development Dependencies ({devDependencies.length})
              </h3>
              <div className="grid gap-2">
                {devDependencies.map((dep) => (
                  <div
                    key={dep.name}
                    className="p-3 rounded-lg border"
                    style={{
                      backgroundColor: "#2d2d2d",
                      borderColor: "#4a5568",
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4
                          style={{
                            fontSize: "10px",
                            fontWeight: "500",
                            color: "#e5e7eb",
                            margin: 0,
                          }}
                        >
                          {dep.name}
                        </h4>
                        <p
                          style={{
                            fontSize: "10px",
                            color: "#6b7280",
                            margin: 0,
                          }}
                        >
                          Version: {dep.version}
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: "500",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor:
                            dep.license === "MIT" ? "#065f46" : "#7c2d12",
                          color: dep.license === "MIT" ? "#10b981" : "#f97316",
                        }}
                      >
                        {dep.license}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dependencies.length === 0 && (
            <div className="text-center py-12">
              <p style={{ fontSize: "12px", color: "#9ca3af" }}>
                라이브러리 정보가 없습니다.
              </p>
            </div>
          )}
        </div>

        {/* 라이선스 정보 푸터 - 스크롤 영역 밖에 고정 */}
        <div
          style={{
            borderTop: "1px solid #374151",
            padding: "12px 24px",
            backgroundColor: "#2d2d2d",
            flexShrink: 0,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                fontSize: "8px",
                color: "#9ca3af",
                marginBottom: "4px",
                margin: 0,
              }}
            >
              이 애플리케이션은 위에 나열된 오픈소스 라이브러리들을 사용하여
              제작되었습니다.
            </p>
            <p style={{ fontSize: "8px", color: "#6b7280", margin: 0 }}>
              모든 라이브러리는 각각의 라이선스 조건에 따라 사용됩니다.
            </p>
          </div>
        </div>
      </div>
    </>
  );

  // inline 모드에서는 직접 콘텐츠만 반환
  if (inline) {
    return modalContent;
  }

  console.log("🔥 LicenseModal 팝업 모드로 렌더링 중...");

  return (
    <div
      className="fixed"
      style={{
        position: "fixed",
        top: "0",
        left: "0",
        right: "0",
        bottom: "0",
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
      }}
      onClick={(e) => {
        console.log("🔥 모달 배경 클릭됨");
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: "480px",
          height: "640px",
          backgroundColor: "#2d2d2d",
          borderRadius: "8px",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
          position: "relative",
        }}
        onClick={(e) => {
          console.log("🔥 모달 내용 클릭됨");
          e.stopPropagation();
        }}
      >
        {modalContent}
      </div>
    </div>
  );
};
