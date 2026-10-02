import { useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Edit,
  Lock,
  Unlock,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAllPatientsApi,
  resetUserPasswordApi,
  toggleUserStatusApi,
} from "../../../services/authApi";
import type { AuthResponseDto } from "../../../services/authApi";
import { useAuth } from "../../../context/useAuth";
import { useAdminPatients } from "../hooks/useAdminPatients";
import {
  ageFrom,
  filterPatients,
  genderLabel,
  isLocked,
  patientFilterCounts,
  patientInitials,
  PATIENT_FILTERS,
} from "../data/patientFilters";
import type { PatientFilter } from "../data/patientFilters";
import EditPatientModal from "./Modals/EditPatientModal";
import PatientMedicalRecordModal from "./Modals/PatientMedicalRecordModal";

const PAGE_SIZE = 10;

export default function PatientManagementTab() {
  const { user } = useAuth();
  const { patients, isLoading, error, isUnavailable, refresh, applyPatient } =
    useAdminPatients();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<PatientFilter>("ALL");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AuthResponseDto | null>(null);
  const [viewingRecord, setViewingRecord] = useState<AuthResponseDto | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const token = user?.token;

  const counts = useMemo(() => patientFilterCounts(patients), [patients]);

  const filtered = useMemo(
    () => filterPatients(patients, searchQuery, filter),
    [patients, searchQuery, filter],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const effectivePage = Math.min(page, pageCount);
  const paginated = filtered.slice(
    (effectivePage - 1) * PAGE_SIZE,
    effectivePage * PAGE_SIZE,
  );

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setPage(1);
  }

  function handleFilterChange(value: PatientFilter) {
    setFilter(value);
    setPage(1);
  }

  async function handleToggleStatus(patient: AuthResponseDto) {
    if (!token) return;
    const name = patient.fullName;
    setBusyUserId(patient.userId);
    try {
      const updated = await toggleUserStatusApi(patient.userId, token);
      applyPatient(updated);
      toast.success(
        updated.active === false
          ? `Đã khóa tài khoản của ${name}.`
          : `Đã mở khóa tài khoản của ${name}.`,
      );
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Không thể đổi trạng thái tài khoản.",
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleResetPassword(patient: AuthResponseDto) {
    if (!token) return;
    const name = patient.fullName;
    setBusyUserId(patient.userId);
    try {
      const result = await resetUserPasswordApi(patient.userId, token);
      toast.success(result?.message || `Đã đặt lại mật khẩu cho ${name} (password123).`);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Không thể đặt lại mật khẩu.",
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleRefresh() {
    refresh();
    try {
      // Surfaces a stale/expired admin session immediately instead of only
      // leaving an empty table behind.
      if (token) await getAllPatientsApi(token);
    } catch {
      // The hook already records the failure; nothing to add here.
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Quản Lý Bệnh Nhân &amp; Thẻ BHYT
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Dữ liệu trực tiếp từ AuthService (:8085) - định danh CCCD, thẻ BHYT và
            trạng thái tài khoản
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw
            size={14}
            className={isLoading ? "animate-spin" : ""}
            aria-hidden="true"
          />
          Làm mới
        </button>
      </div>

      {isUnavailable && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle
            size={16}
            className="mt-0.5 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <div>
            <p className="text-xs font-bold text-amber-800">
              Không tải được danh sách bệnh nhân
            </p>
            <p className="mt-0.5 text-xs text-amber-700">{error}</p>
            <p className="mt-1 text-[11px] text-amber-600">
              Endpoint <code>/api/v1/auth/admin/patients</code> cần được triển khai
              và khởi động lại trên AuthService.
            </p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-10 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Đang tải danh sách bệnh nhân...
        </div>
      )}

      {!isLoading && (
        <>
          {/* Search & filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Tìm theo tên, email, SĐT, CCCD hoặc mã thẻ BHYT..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {PATIENT_FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleFilterChange(option.value)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === option.value
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {option.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      filter === option.value
                        ? "bg-white/20 text-white"
                        : "bg-white text-slate-500"
                    }`}
                  >
                    {counts[option.value]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Bệnh nhân
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Liên hệ
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Thẻ BHYT &amp; Tuyến KCB
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Định danh CCCD
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Xác thực OCR
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Trạng thái
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((patient) => {
                    const locked = isLocked(patient);
                    const busy = busyUserId === patient.userId;
                    const age = ageFrom(patient.dateOfBirth);
                    const gender = genderLabel(patient.gender);

                    return (
                      <tr
                        key={patient.userId}
                        className="transition-colors hover:bg-slate-50/50"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-clinical-100 text-xs font-bold text-clinical-700">
                              {patientInitials(patient.fullName)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-800">
                                {patient.fullName}
                              </p>
                              <p className="truncate text-[11px] text-slate-400">
                                {patient.email}
                              </p>
                              {(age !== null || gender) && (
                                <p className="text-[11px] text-slate-400">
                                  {age !== null ? `${age} tuổi` : "—"}
                                  {age !== null && gender ? " · " : ""}
                                  {gender ?? ""}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <p>{patient.phone || "—"}</p>
                          {patient.address && (
                            <p
                              className="max-w-[180px] truncate text-[11px] text-slate-400"
                              title={patient.address}
                            >
                              {patient.address}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {patient.insuranceCode?.trim() ? (
                            <>
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-800">
                                <CreditCard size={10} aria-hidden="true" />
                                {patient.insuranceCode}
                              </span>
                              {patient.initialHospitalCode && (
                                <p className="mt-1 text-[11px] text-slate-400">
                                  {patient.initialHospitalCode}
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-300">Chưa đăng ký</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                          {patient.identityCardNumber || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              patient.isOcrVerified
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {patient.isOcrVerified ? (
                              <>
                                <ShieldCheck size={10} aria-hidden="true" />
                                Đã xác thực
                              </>
                            ) : (
                              "Chưa xác thực"
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              locked
                                ? "bg-red-50 text-red-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                locked ? "bg-red-500" : "bg-emerald-500"
                              }`}
                            />
                            {locked ? "Đã khóa" : "Hoạt động"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setViewingRecord(patient)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-clinical-600 transition-colors hover:bg-clinical-50"
                              title="Xem hồ sơ bệnh án điện tử"
                              aria-label={`Xem hồ sơ bệnh án điện tử của ${patient.fullName}`}
                            >
                              <FileText size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditing(patient)}
                              disabled={busy}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                              title="Sửa hồ sơ & BHYT"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleStatus(patient)}
                              disabled={busy}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                              title={locked ? "Mở khóa tài khoản" : "Khóa tài khoản"}
                            >
                              {locked ? <Unlock size={14} /> : <Lock size={14} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleResetPassword(patient)}
                              disabled={busy}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                              title="Đặt lại mật khẩu"
                            >
                              <KeyRound size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-sm text-slate-400"
                      >
                        {patients.length === 0
                          ? "Chưa có tài khoản bệnh nhân nào trong hệ thống."
                          : "Không tìm thấy bệnh nhân phù hợp với bộ lọc."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-slate-500">
              Hiển thị{" "}
              <span className="font-semibold text-slate-700">
                {filtered.length === 0
                  ? 0
                  : (effectivePage - 1) * PAGE_SIZE + 1}
                -{Math.min(effectivePage * PAGE_SIZE, filtered.length)}
              </span>{" "}
              trong <span className="font-semibold text-slate-700">{filtered.length}</span>{" "}
              bệnh nhân
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={effectivePage <= 1}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={14} aria-hidden="true" />
                Trước
              </button>
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                Trang {effectivePage} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={effectivePage >= pageCount}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sau
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
      )}

      {viewingRecord && (
        <PatientMedicalRecordModal
          open
          patient={viewingRecord}
          onClose={() => setViewingRecord(null)}
        />
      )}

      {editing && (
        <EditPatientModal
          patient={editing}
          token={token}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            applyPatient(updated);
            setEditing(null);
            toast.success(
              `Đã cập nhật hồ sơ & BHYT của ${updated.fullName}.`,
            );
          }}
        />
      )}
    </div>
  );
}
