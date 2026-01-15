'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { LogEntry, LogLevel } from '@/lib/api/types';
import { mediaApi } from '@/lib/api/endpoints';
import {
    Card,
    CardContent,
    CardHeader
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

const LOG_LEVELS: LogLevel[] = ['Verbose', 'Debug', 'Information', 'Warning', 'Error', 'Fatal'];

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
    Verbose: 'text-gray-400',
    Debug: 'text-blue-400',
    Information: 'text-green-400',
    Warning: 'text-yellow-400',
    Error: 'text-red-400',
    Fatal: 'text-red-600'
};

type ColumnKey = 'timestamp' | 'level' | 'message';

type Column = {
    key: ColumnKey;
    label: string;
};

const columns: Column[] = [
    { key: 'timestamp', label: 'Time' },
    { key: 'level', label: 'Level' },
    { key: 'message', label: 'Message' },
];

export default function LogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [minLevel, setMinLevel] = useState<LogLevel>('Information');
    const [searchTerm, setSearchTerm] = useState('');
    const [refreshInterval, setRefreshInterval] = useState<number>(5000);

    const fetchLogs = useCallback(async () => {
        try {
            const data = await mediaApi.getLogs({
                minLevel: minLevel || undefined,
                searchTerm: searchTerm || undefined,
                limit: 100
            });
            setLogs(data.logs);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    }, [minLevel, searchTerm]);

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, refreshInterval);
        return () => clearInterval(interval);
    }, [fetchLogs, refreshInterval]);

    const renderCell = useCallback((log: LogEntry, columnKey: ColumnKey) => {
        switch (columnKey) {
            case 'timestamp':
                return format(new Date(log.Timestamp), 'HH:mm:ss.SSS');
            case 'level':
                return (
                    <span className={LOG_LEVEL_COLORS[log.Level]}>
                        {log.Level}
                    </span>
                );
            case 'message':
                return (
                    <div className="min-w-[500px]">
                        <div>{log.RenderedMessage}</div>
                        {log.Exception && (
                            <pre className="mt-2 p-2 bg-destructive/20 rounded text-sm overflow-auto">
                                {log.Exception}
                            </pre>
                        )}
                        {Object.entries(log.Properties).length > 0 && (
                            <details className="mt-2">
                                <summary className="cursor-pointer text-sm text-muted-foreground">
                                    Properties
                                </summary>
                                <pre className="mt-1 p-2 bg-muted rounded text-sm overflow-auto">
                                    {JSON.stringify(log.Properties, null, 2)}
                                </pre>
                            </details>
                        )}
                    </div>
                );
            default:
                return null;
        }
    }, []);

    return (
        <div className="container mx-auto p-4 space-y-4">
            <Card>
                <CardHeader className="flex flex-row gap-4">
                    <div className="flex flex-1 gap-4">
                        <Select
                            value={minLevel}
                            onValueChange={(value) => setMinLevel(value as LogLevel)}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Minimum Level" />
                            </SelectTrigger>
                            <SelectContent>
                                {LOG_LEVELS.map((level) => (
                                    <SelectItem key={level} value={level}>
                                        {level}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        
                        <Input
                            placeholder="Search in logs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-xs"
                        />
                        
                        <Select
                            value={refreshInterval.toString()}
                            onValueChange={(value) => setRefreshInterval(Number(value))}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Refresh Interval" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2000">2 seconds</SelectItem>
                                <SelectItem value="5000">5 seconds</SelectItem>
                                <SelectItem value="10000">10 seconds</SelectItem>
                                <SelectItem value="30000">30 seconds</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : error ? (
                        <div className="text-destructive p-4">{error}</div>
                    ) : (
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {columns.map((column) => (
                                            <TableHead key={column.key}>
                                                {column.label}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => (
                                        <TableRow key={`${log.Timestamp}-${log.RenderedMessage}`}>
                                            {columns.map((column) => (
                                                <TableCell key={column.key}>
                                                    {renderCell(log, column.key)}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
} 