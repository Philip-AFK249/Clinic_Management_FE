import { useEffect, useState } from "react";
import { Pill, CreditCard, Building2, Edit, Plus, PackagePlus, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { DrugDto } from "../../../services/clinicalApi";
import { getDrugsApi } from "../../../services/clinicalApi";
import type { HospitalCode, ServiceFee } from "../data/adminMockData";
import {
  MOCK_HOSPITAL_CODES,
  MOCK_SERVICE_FEES,
} from "../data/adminMockData";
import CreateDrugModal from "./Modals/CreateDrugModal";
import EditDrugModal from "./Modals/EditDrugModal";
import RestockDrugModal from "./Modals/RestockDrugModal";

type CatalogSubTab = "DRUGS" | "BHYT" | "SERVICES";

const BHYT_COVERAGE_LABELS: Record<string, string> = {
  BHYT_80: "BHYT 80%",
  "BHYT 80%": "BHYT 80%",
  BHYT_100: "BHYT 100%",
  "BHYT 100%": "BHYT 100%",
  SELF_PAY: "Tự túc",
  "Tự túc": "Tự túc",
};

const BHYT_COVERAGE_STYLES: Record<string, string> = {
  BHYT_80: "bg-blue-100 text-blue-800 border-blue-200",
  "BHYT 80%": "bg-blue-100 text-blue-800 border-blue-200",
  BHYT_100: "bg-emerald-100 text-emerald-800 border-emerald-200",
  "BHYT 100%": "bg-emerald-100 text-emerald-800 border-emerald-200",
  SELF_PAY: "bg-slate-100 text-slate-600 border-slate-200",
  "Tự túc": "bg-slate-100 text-slate-600 border-slate-200",
};

export default function MedicalCatalogTab() {
  const [activeSubTab, setActiveSubTab] = useState<CatalogSubTab>("DRUGS");
  const [drugs, setDrugs] = useState<DrugDto[]>([]);
  const [isLoadingDrugs, setIsLoadingDrugs] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [hospitals] = useState<HospitalCode[]>(MOCK_HOSPITAL_CODES);
  const [services] = useState<ServiceFee[]>(MOCK_SERVICE_FEES);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<DrugDto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDrugs = async () => {
    setIsLoadingDrugs(true);
    try {
      const data = await getDrugsApi();
      setDrugs(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tải danh sách thuốc");
    } finally {
      setIsLoadingDrugs(false);
    }
  };

  useEffect(() => {
    fetchDrugs();
  }, []);

  const filteredDrugs = drugs.filter((drug) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      drug.name.toLowerCase().includes(term) ||
      drug.code.toLowerCase().includes(term)
    );
  });

  const subTabs: { key: CatalogSubTab; label: string; icon: typeof Pill }[] = [
    { key: "DRUGS", label: "Danh mục Thuốc & Tồn kho", icon: Pill },
    { key: "BHYT", label: "Danh mục BHYT & Bệnh viện ban đầu", icon: Building2 },
    { key: "SERVICES", label: "Bảng giá Dịch vụ", icon: CreditCard },
  ];

  const handleOpenCreate = () => setIsCreateModalOpen(true);
  const handleOpenEdit = (drug: DrugDto) => {
    setSelectedDrug(drug);
    setIsEditModalOpen(true);
  };
  const handleOpenRestock = (drug: DrugDto) => {
    setSelectedDrug(drug);
    setIsRestockModalOpen(true);
  };

  const handleCreated = async () => {
    setIsSubmitting(true);
    try {
      await fetchDrugs();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdated = async () => {
    setIsSubmitting(true);
    try {
      await fetchDrugs();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestocked = async () => {
    setIsSubmitting(true);
    try {
      await fetchDrugs();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900">
          Danh mục Thuốc, Viện phí & BHYT
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Quản lý danh mục thuốc, mã bệnh viện ban đầu và bảng giá dịch vụ khám chữa bệnh
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-200/80 bg-white p-1 shadow-card">
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveSubTab(tab.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
              activeSubTab === tab.key
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <tab.icon size={14} aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Drug Inventory */}
      {activeSubTab === "DRUGS" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm theo tên thuốc hoặc mã thuốc..."
                className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs transition-colors focus:border-clinical-500 focus:outline-none focus:ring-2 focus:ring-clinical-500/20"
              />
            </div>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-900"
            >
              <Plus size={14} />
              Thêm Thuốc Mới
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 font-semibold text-slate-600">Thuốc</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Hàm lượng</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Đơn giá (VNĐ)</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Tồn kho (đơn vị)</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">BHYT Coverage</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingDrugs ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8">
                        <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                          <Loader2 size={18} className="animate-spin" />
                          <p className="text-xs">Đang tải danh sách thuốc...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredDrugs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-500">
                        {searchTerm ? "Không tìm thấy thuốc phù hợp với từ khóa tìm kiếm" : "Chưa có thuốc nào trong kho"}
                      </td>
                    </tr>
                  ) : (
                    filteredDrugs.map((drug) => (
                      <tr key={drug.id} className="transition-colors hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-clinical-50">
                              <Pill size={14} className="text-clinical-600" aria-hidden="true" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{drug.name}</p>
                              <p className="text-[11px] text-slate-500">{drug.code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{drug.concentration}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {drug.unitPrice.toLocaleString("vi-VN")}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-semibold ${
                              drug.stockQuantity < 500 ? "text-red-600" : "text-slate-800"
                            }`}
                          >
                            {drug.stockQuantity.toLocaleString("vi-VN")}
                          </span>
                          {drug.stockQuantity < 500 && (
                            <span className="ml-1.5 inline-flex rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                              Sắp hết
                            </span>
                          )}
                          {drug.isPenicillinClass && (
                            <span className="ml-1.5 inline-flex rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                              Penicillin
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${BHYT_COVERAGE_STYLES[drug.bhytCoverage]}`}
                          >
                            {BHYT_COVERAGE_LABELS[drug.bhytCoverage] || drug.bhytCoverage}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(drug)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100"
                            >
                              <Edit size={12} aria-hidden="true" />
                              Chỉnh sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenRestock(drug)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
                            >
                              <PackagePlus size={12} aria-hidden="true" />
                              Nhập kho
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* BHYT Hospital Codes */}
      {activeSubTab === "BHYT" && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-xs font-bold text-slate-700">Mã Bệnh viện Ban đầu (BHYT)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-3 font-semibold text-slate-600">Mã BV</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Tên Bệnh viện</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Tỷ lệ đồng chi trả</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hospitals.map((h) => (
                    <tr key={h.code} className="transition-colors hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                        {h.code}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{h.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            h.copayPercent <= 20
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          Đúng tuyến: {100 - h.copayPercent}% | Trái tuyến: {h.copayPercent > 20 ? 100 - h.copayPercent - 20 : 40}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100"
                        >
                          <Edit size={12} aria-hidden="true" />
                          Chỉnh sửa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card">
            <h3 className="mb-3 text-xs font-bold text-slate-700">Tỷ lệ Đồng chi trả BHYT</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold text-emerald-800">Đúng tuyến</p>
                <p className="mt-1 text-lg font-bold text-emerald-700">80% BHYT chi trả</p>
                <p className="text-[11px] text-emerald-600">Bệnh nhân đồng chi trả 20%</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800">Trái tuyến</p>
                <p className="mt-1 text-lg font-bold text-amber-700">40% BHYT chi trả</p>
                <p className="text-[11px] text-amber-600">Bệnh nhân đồng chi trả 60%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service Fees */}
      {activeSubTab === "SERVICES" && (
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 font-semibold text-slate-600">Mã DV</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Tên Dịch vụ</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Giá (VNĐ)</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">BHYT</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {services.map((svc) => (
                  <tr key={svc.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono text-slate-600">{svc.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{svc.name}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {svc.price.toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          svc.bhytCovered
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {svc.bhytCovered ? "BHYT chi trả" : "Tự túc"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        <Edit size={12} aria-hidden="true" />
                        Chỉnh sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateDrugModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleCreated}
        isSubmitting={isSubmitting}
      />
      <EditDrugModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedDrug(null);
        }}
        drug={selectedDrug}
        onUpdated={handleUpdated}
        isSubmitting={isSubmitting}
      />
      <RestockDrugModal
        isOpen={isRestockModalOpen}
        onClose={() => {
          setIsRestockModalOpen(false);
          setSelectedDrug(null);
        }}
        drug={selectedDrug}
        onRestocked={handleRestocked}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
