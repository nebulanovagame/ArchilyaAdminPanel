"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableStatus } from "@/components/ui/table";
import { listUsers } from "@/lib/api/admin-client";
import type { UserRecord } from "@/lib/api/types";

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Kullanicilar yukleniyor..." />;
  if (error) return <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
        <h1 className="font-serif text-3xl text-white italic">Kullanicilar</h1>
      </div>

      {users.length === 0 ? (
        <EmptyState icon={UserRound} title="Kullanici bulunamadi" />
      ) : (
        <div className="glass-card rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Isim</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Kayit Tarihi</TableHead>
                <TableHead>Islem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="text-sm">{user.email}</TableCell>
                  <TableCell>{user.displayName || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "warning" : "default"}>
                      {user.role === "admin" ? "Admin" : "Kullanici"}
                    </Badge>
                  </TableCell>
                  <TableCell><TableStatus status={user.status} /></TableCell>
                  <TableCell>{user.workspaceCount}</TableCell>
                  <TableCell className="text-[11px] text-gray-500">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString("tr-TR") : "-"}
                  </TableCell>
                  <TableCell>
                    <Link href={`/users/${user.id}`}>
                      <Button variant="secondary" size="sm">
                        Goruntule <ArrowRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
