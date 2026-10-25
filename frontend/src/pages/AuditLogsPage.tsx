import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { BRAND_CONFIG } from '../config/branding';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Shield,
  Filter,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Code2,
  Columns,
  Rows,
} from 'lucide-react';

interface AuditRecord {
  id: string;
  actorId?: string | null;
  action: string;
  targetResource: string;
  targetResourceId?: string | null;
  details?: any;
  ipAddress?: string | null;
  createdAt: string;
  actor?: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  } | null;
}

interface AuditApiResponse {
  items: AuditRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const AuditLogsPage: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Details Modal Inspection
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter && actionFilter !== 'ALL') params.append('action', actionFilter);
      params.append('page', String(page));
      params.append('pageSize', String(pageSize));

      const data = await apiClient.get<any, AuditApiResponse>(
        `/audit/logs?${params.toString()}`,
      );
      setLogs(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, page, pageSize]);

  // Reset to page 1 when filter changes
  const handleFilterChange = (val: string) => {
    setActionFilter(val);
    setPage(1);
  };

  const handlePageSizeChange = (val: string) => {
    setPageSize(Number(val));
    setPage(1);
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('healthclaim_token');
      const params = new URLSearchParams();
      if (actionFilter && actionFilter !== 'ALL') params.append('action', actionFilter);

      const response = await fetch(
        `http://localhost:4000/api/v1/audit/export/csv?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) throw new Error('Failed to export CSV');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `healthclaim_audit_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Audit logs CSV exported successfully');
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async (orientation: 'landscape' | 'portrait' = 'landscape') => {
    setExportingPdf(true);
    try {
      // 1. Fetch current filtered dataset (up to 200 records)
      const params = new URLSearchParams();
      if (actionFilter && actionFilter !== 'ALL') params.append('action', actionFilter);
      params.append('page', '1');
      params.append('pageSize', '200');

      const data = await apiClient.get<any, AuditApiResponse>(
        `/audit/logs?${params.toString()}`,
      );
      const exportLogs = data.items && data.items.length > 0 ? data.items : logs;

      const isLandscape = orientation === 'landscape';

      // 2. Initialize jsPDF Document
      const doc = new jsPDF({
        orientation,
        unit: 'mm',
        format: 'a4',
      });

      const exportTimestamp = new Date().toLocaleString();
      const exporterName = user ? `${user.firstName} ${user.lastName} (${user.email})` : 'Authorized User';
      const filterLabel = actionFilter === 'ALL' ? 'All Audit Actions' : actionFilter;

      const pageWidth = isLandscape ? 297 : 210;
      const pageHeight = isLandscape ? 210 : 297;
      const marginSide = isLandscape ? 12 : 10;
      const rightEdge = pageWidth - marginSide;

      // 3. Render High-Fidelity Vector AutoTable
      autoTable(doc, {
        head: [['Timestamp', 'Event Action', 'Actor Identity', 'Resource', 'Payload Details Snapshot', 'Origin IP']],
        body: exportLogs.map((log) => [
          new Date(log.createdAt).toLocaleString(),
          log.action,
          log.actor ? `${log.actor.firstName} ${log.actor.lastName}\n${log.actor.email}` : 'System Kernel',
          log.targetResource,
          log.details ? (typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)) : '—',
          log.ipAddress || '127.0.0.1',
        ]),
        startY: 30,
        margin: { top: 30, right: marginSide, bottom: 16, left: marginSide },
        styles: {
          fontSize: isLandscape ? 8 : 7.2,
          cellPadding: isLandscape ? 2.5 : 2,
          valign: 'middle',
          overflow: 'linebreak',
          textColor: [30, 41, 59],
        },
        headStyles: {
          fillColor: [10, 37, 64], // #0a2540 brand navy
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: isLandscape ? 8.5 : 7.5,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: isLandscape
          ? {
              0: { cellWidth: 38 }, // Timestamp
              1: { cellWidth: 44, fontStyle: 'bold' }, // Event Action
              2: { cellWidth: 46 }, // Actor Identity
              3: { cellWidth: 26 }, // Resource
              4: { cellWidth: 'auto' }, // Payload Details (auto wraps)
              5: { cellWidth: 26, halign: 'right' }, // Origin IP
            }
          : {
              0: { cellWidth: 26 }, // Timestamp
              1: { cellWidth: 32, fontStyle: 'bold' }, // Event Action
              2: { cellWidth: 36 }, // Actor Identity
              3: { cellWidth: 20 }, // Resource
              4: { cellWidth: 'auto' }, // Payload Details (auto wraps)
              5: { cellWidth: 22, halign: 'right' }, // Origin IP
            },
        didDrawPage: (pageData) => {
          // Top Header on Every Page
          doc.setFontSize(isLandscape ? 13 : 11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(10, 37, 64);
          doc.text('HealthClaim Pro — Audit & Compliance Log Report', marginSide, 12);

          doc.setFontSize(isLandscape ? 8 : 7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text(
            `Generated: ${exportTimestamp}   |   Exported By: ${exporterName}   |   Filter: ${filterLabel}   |   Records: ${exportLogs.length}   |   Layout: ${orientation.toUpperCase()}`,
            marginSide,
            18,
          );

          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.4);
          doc.line(marginSide, 22, rightEdge, 22);

          // Bottom Footer on Every Page
          const pageCount = (doc as any).internal.getNumberOfPages();
          doc.setFontSize(isLandscape ? 8 : 7);
          doc.setTextColor(148, 163, 184);
          doc.text(`Page ${pageData.pageNumber} of ${pageCount}`, rightEdge, pageHeight - 8, { align: 'right' });
          doc.text('HealthClaim Pro Enterprise • System Audit Trail Log Export', marginSide, pageHeight - 8);
        },
      });

      // 4. Instant Vector PDF Download
      const fileName = `healthclaim_audit_${orientation}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      toast.success(`Vector audit report PDF (${orientation}) exported: ${fileName}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to export PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, total);

  return (
    <div className="h-[calc(100vh-7.5rem)] flex flex-col min-h-0 space-y-3.5 text-slate-900">
      {/* Header with Export Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#0a2540] flex items-center gap-2">
            <Shield className="h-5 w-5 text-slate-700" />
            Audit Trails & Compliance Stream
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log tracking identity authentication, role modifications, claims, and policy assignments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={exporting}
            className="gap-2 text-xs font-semibold h-8 bg-white"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
          </Button>

          {/* Export PDF with Orientation Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={exportingPdf}
                className="gap-1.5 text-xs font-semibold h-8 bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50/50"
              >
                <FileText className="h-4 w-4 text-indigo-600" />
                <span>{exportingPdf ? 'Exporting...' : 'Export PDF'}</span>
                <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1 shadow-lg">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                Select PDF Orientation
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleExportPdf('landscape')}
                className="gap-2.5 py-2 cursor-pointer"
              >
                <Columns className="h-4 w-4 text-indigo-600 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900 text-xs">Landscape (A4)</p>
                  <p className="text-[10px] text-slate-400">Wide view • Best for multi-column tables</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExportPdf('portrait')}
                className="gap-2.5 py-2 cursor-pointer"
              >
                <Rows className="h-4 w-4 text-slate-600 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900 text-xs">Portrait (A4)</p>
                  <p className="text-[10px] text-slate-400">Standard document binder format</p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-600 font-semibold whitespace-nowrap">Filter Action:</span>
          <div className="w-64">
            <Select value={actionFilter} onValueChange={handleFilterChange}>
              <SelectTrigger className="h-8 text-xs bg-slate-50/50">
                <SelectValue placeholder="All Audit Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Audit Actions</SelectItem>
                <SelectItem value="GENERATE_SETTLEMENT_VOUCHER">GENERATE_SETTLEMENT_VOUCHER</SelectItem>
                <SelectItem value="TRANSITION_CLAIM_STATUS">TRANSITION_CLAIM_STATUS</SelectItem>
                <SelectItem value="SUBMIT_CLAIM">SUBMIT_CLAIM</SelectItem>
                <SelectItem value="USER_LOGIN">USER_LOGIN</SelectItem>
                <SelectItem value="UPDATE_SELF_PROFILE">UPDATE_SELF_PROFILE</SelectItem>
                <SelectItem value="UPDATE_USER_ROLE">UPDATE_USER_ROLE</SelectItem>
                <SelectItem value="UPDATE_USER_STATUS">UPDATE_USER_STATUS</SelectItem>
                <SelectItem value="ASSIGN_POLICY_TIER">ASSIGN_POLICY_TIER</SelectItem>
                <SelectItem value="CREATE_BENEFIT_TIER">CREATE_BENEFIT_TIER</SelectItem>
                <SelectItem value="UPDATE_BENEFIT_TIER">UPDATE_BENEFIT_TIER</SelectItem>
                <SelectItem value="DELETE_BENEFIT_TIER">DELETE_BENEFIT_TIER</SelectItem>
                <SelectItem value="CREATE_COMPLIANCE_RULE">CREATE_COMPLIANCE_RULE</SelectItem>
                <SelectItem value="UPDATE_COMPLIANCE_RULE">UPDATE_COMPLIANCE_RULE</SelectItem>
                <SelectItem value="REORDER_COMPLIANCE_RULES">REORDER_COMPLIANCE_RULES</SelectItem>
                <SelectItem value="ADMIN_CREATE_USER">ADMIN_CREATE_USER</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
          <span>
            Total: <strong className="text-slate-900">{total}</strong> records
          </span>
        </div>
      </div>

      {/* Viewport Filling Dedicated Scrollable Table Container */}
      <div className="flex-1 min-h-0 flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Scrollable Table Body Area */}
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 relative">
          <Table className="w-full table-fixed text-xs">
            <TableHeader>
              <TableRow className="border-b border-slate-200 bg-slate-50/75">
                <TableHead className="w-[17%] text-slate-700 font-bold text-[11px] uppercase">
                  Timestamp
                </TableHead>
                <TableHead className="w-[18%] text-slate-700 font-bold text-[11px] uppercase">
                  Event Action
                </TableHead>
                <TableHead className="w-[20%] text-slate-700 font-bold text-[11px] uppercase">
                  Actor Identity
                </TableHead>
                <TableHead className="w-[13%] text-slate-700 font-bold text-[11px] uppercase">
                  Resource
                </TableHead>
                <TableHead className="w-[22%] text-slate-700 font-bold text-[11px] uppercase">
                  Payload Details
                </TableHead>
                <TableHead className="w-[10%] text-right text-slate-700 font-bold text-[11px] uppercase">
                  Origin IP
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-slate-400 font-sans">
                    Loading audit stream...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-slate-400 font-sans">
                    No audit records found matching current criteria.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow
                    key={log.id}
                    onClick={() => setSelectedRecord(log)}
                    className="cursor-pointer hover:bg-slate-50/80 transition-colors border-b border-slate-100"
                  >
                    <TableCell className="text-slate-500 font-mono text-[11px] whitespace-nowrap py-2.5">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span className="px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 font-mono font-bold text-slate-800 text-[11px]">
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 truncate">
                      {log.actor ? (
                        <div>
                          <p className="font-semibold text-slate-900 text-xs truncate">
                            {log.actor.firstName} {log.actor.lastName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{log.actor.email}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs font-sans">
                          System Kernel
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-700 font-semibold text-xs py-2.5 truncate">
                      {log.targetResource}
                    </TableCell>
                    <TableCell className="text-slate-600 font-mono text-[11px] truncate py-2.5">
                      {log.details ? (
                        typeof log.details === 'object' ? (
                          <span className="text-slate-700">{JSON.stringify(log.details)}</span>
                        ) : (
                          String(log.details)
                        )
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500 font-mono text-[11px] text-right py-2.5">
                      {log.ipAddress || '127.0.0.1'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Dedicated Fixed Pagination Footer */}
        <div className="shrink-0 p-3.5 px-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-medium">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-slate-900 font-mono">{startIndex}</strong> - <strong className="text-slate-900 font-mono">{endIndex}</strong> of <strong className="text-slate-900 font-mono">{total}</strong> records
            </span>
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <span className="text-slate-500 text-[11px]">Rows per page:</span>
              <div className="w-20">
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="h-7 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[11px] font-mono mr-2">
              Page {page} of {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="h-7 px-2 text-xs gap-1 bg-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="h-7 px-2 text-xs gap-1 bg-white"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Record Payload Inspection Modal (Screen Mode Only) */}
      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader className="pr-6">
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-600" />
              Audit Record Details: {selectedRecord?.action}
            </DialogTitle>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-3.5 text-xs text-slate-700 mt-2">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Timestamp</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {new Date(selectedRecord.createdAt).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">IP Address</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {selectedRecord.ipAddress || '127.0.0.1'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Actor</span>
                  <span className="font-semibold text-slate-900">
                    {selectedRecord.actor
                      ? `${selectedRecord.actor.firstName} ${selectedRecord.actor.lastName} (${selectedRecord.actor.role})`
                      : 'System Kernel'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Target Resource</span>
                  <span className="font-semibold text-slate-900">{selectedRecord.targetResource}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5 flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5" /> Payload Details Snapshot
                </span>
                <pre className="p-3.5 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-60">
                  {JSON.stringify(selectedRecord.details || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

