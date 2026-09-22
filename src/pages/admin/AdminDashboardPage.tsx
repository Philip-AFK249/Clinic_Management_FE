import { useState } from "react";
import { toast } from "sonner";
import type {
  StaffAccount,
  KnowledgeDocument,
  AdminTab,
} from "./data/adminMockData";
import AdminSidebar from "./components/AdminSidebar";
import AdminHeader from "./components/AdminHeader";
import OverviewTab from "./components/OverviewTab";
import DoctorRosterTab from "./components/DoctorRosterTab";
import UserManagementTab from "./components/UserManagementTab";
import MedicalCatalogTab from "./components/MedicalCatalogTab";
import AiGatewayTab from "./components/AiGatewayTab";
import { useAdminMetrics } from "./hooks/useAdminMetrics";
import { useKnowledgeBase } from "./hooks/useKnowledgeBase";

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("OVERVIEW");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const metrics = useAdminMetrics();
  const kb = useKnowledgeBase();

  function handleAddStaff(staff: StaffAccount) {
    metrics.addStaff(staff);
  }

  function handleToggleStaffStatus(staffId: string) {
    metrics.toggleStaffStatus(staffId);
  }

  function handleResetPassword(staffId: string) {
    const staff = metrics.staffList.find((s) => s.id === staffId);
    const name = staff?.fullName ?? "người dùng";
    toast.success(`Đã đặt lại mật khẩu cho ${name}. Email hướng dẫn đã được gửi.`);
  }

  function handleAddKnowledgeDoc(doc: KnowledgeDocument) {
    kb.addDocument(doc);
  }

  function handleDeleteKnowledgeDoc(docId: string) {
    kb.deleteDocument(docId);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-light text-slate-900 font-sans">
      <AdminHeader metrics={metrics.metrics} />

      <div className="flex min-h-0 flex-1">
        <AdminSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
            {activeTab === "OVERVIEW" && <OverviewTab metrics={metrics.metrics} />}
            {activeTab === "ROSTER" && <DoctorRosterTab />}
            {activeTab === "USERS" && (
              <UserManagementTab
                staffList={metrics.staffList}
                onToggleStatus={handleToggleStaffStatus}
                onResetPassword={handleResetPassword}
                onAddStaff={handleAddStaff}
              />
            )}
            {activeTab === "CATALOGS" && <MedicalCatalogTab />}
            {activeTab === "AI_GATEWAY" && (
              <AiGatewayTab
                documents={kb.documents}
                ocrLogs={metrics.ocrLogs}
                isReindexing={kb.isReindexing}
                reindexProgress={kb.reindexProgress}
                onAddDocument={handleAddKnowledgeDoc}
                onDeleteDocument={handleDeleteKnowledgeDoc}
                onTriggerReindex={kb.triggerReindex}
              />
            )}
          </div>

          <footer className="flex h-10 shrink-0 items-center justify-between border-t border-slate-200/80 bg-white px-5 text-[11px] text-slate-400">
            <span>
              Smart Clinic Admin Console &middot; PostgreSQL 16 + pgvector &middot; PaddleOCR &
              Whisper &middot; GPT-4o
            </span>
            <span>Phiên bản CSDL: v1.26 · Đồng bộ 09/2026</span>
          </footer>
        </main>
      </div>
    </div>
  );
}