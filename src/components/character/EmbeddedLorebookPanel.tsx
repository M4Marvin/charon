import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CharacterDataV2 } from "@/lib/st-core/character";

export function EmbeddedLorebookPanel({
  book,
}: {
  book: NonNullable<CharacterDataV2["character_book"]>;
}) {
  const entries = book.entries ?? [];

  return (
    <Card>
      <Collapsible>
        <CardHeader className="px-0 pt-0">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="hover:bg-muted/40 -mx-2 flex w-[calc(100%+1rem)] items-center justify-between rounded-md px-2 py-1 text-left transition-colors"
            >
              <div>
                <CardTitle>{book.name || "Embedded Lorebook"}</CardTitle>
                {book.description ? (
                  <CardDescription className="line-clamp-1">{book.description}</CardDescription>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {entries.length} {entries.length === 1 ? "entry" : "entries"}
                </Badge>
                {book.scan_depth !== undefined ? (
                  <Badge variant="outline">scan {book.scan_depth}</Badge>
                ) : null}
                {book.recursive_scanning ? <Badge variant="outline">recursive</Badge> : null}
                <span className="text-muted-foreground text-xs">▾</span>
              </div>
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="px-0 pb-0">
            {entries.length === 0 ? (
              <p className="text-muted-foreground text-sm">No entries in this embedded book.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comment</TableHead>
                    <TableHead>Keys</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead className="w-20">Pos</TableHead>
                    <TableHead className="w-16">On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, i) => (
                    <TableRow key={entry.id ?? i}>
                      <TableCell className="line-clamp-1 max-w-xs">
                        {entry.comment || entry.name || (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.keys.join(", ") || (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground line-clamp-2 max-w-md text-xs">
                        {entry.content}
                      </TableCell>
                      <TableCell className="text-xs">{entry.position ?? "—"}</TableCell>
                      <TableCell>
                        {entry.enabled === false ? (
                          <Badge variant="outline">off</Badge>
                        ) : (
                          <Badge>on</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
