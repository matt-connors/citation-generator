import React, { useState } from "react";
import { Input } from "./Input";
import type { Source } from "../../lib/citations/definitions";
import { Button } from "./Button";
import { Building2, ChevronDown, UserRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";
import { cn } from "./utils";


const Contributors = ({ source }: { source: Source }) => {
    const [tab, setTab] = useState("person");
    return (
        <div className="grid grid-cols-[120px_1fr] gap-3">
            <span className="flex flex-col leading-4 text-sm h-9 justify-center">
                Contributors
                <span className="text-xs text-muted-foreground">Recommended</span>
            </span>
            <div className="flex flex-col gap-4">
                {source.citationInfo.authors.map((author) => (
                    <details className="border border-border rounded-md shadow-sm [&[open]_summary_svg]:rotate-180">
                        <summary className="px-3 cursor-pointer w-full h-9 flex justify-between items-center">
                            <span className="leading-none">{author}</span>
                            <ChevronDown size={16} strokeWidth={1.5} className="transform transition-transform duration-100" />
                        </summary>
                        <Line />
                        <div className="p-3 pb-4">
                            <Tabs defaultValue="person" onValueChange={setTab} value={tab}>
                                <TabsList className="mt-1 mb-4">
                                    <TabsTrigger value="person">Person</TabsTrigger>
                                    <TabsTrigger value="organization">Organization</TabsTrigger>
                                </TabsList>
                                <TabsContent value="person" className="flex flex-col gap-4">
                                    {/* Title */}
                                    <label className="grid grid-cols-[110px_1fr] items-center gap-3">
                                        <span className="flex flex-col leading-4 text-sm">
                                            Title
                                        </span>
                                        <Input placeholder="Title" type="text" />
                                    </label>
                                    {/* Initials */}
                                    <label className="grid grid-cols-[110px_1fr] items-center gap-3">
                                        <span className="flex flex-col leading-4 text-sm">
                                            Initials
                                        </span>
                                        <Input placeholder="Initials" type="text" />
                                    </label>
                                    {/* First Name */}
                                    <label className="grid grid-cols-[110px_1fr] items-center gap-3">
                                        <span className="flex flex-col leading-4 text-sm">
                                            First Name
                                            <span className="text-xs text-muted-foreground">Recommended</span>
                                        </span>
                                        <Input placeholder="First Name" type="text" />
                                    </label>
                                    {/* Last Name */}
                                    <label className="grid grid-cols-[110px_1fr] items-center gap-3">
                                        <span className="flex flex-col leading-4 text-sm">
                                            Last Name
                                            <span className="text-xs text-muted-foreground">Recommended</span>
                                        </span>
                                        <Input placeholder="Last Name" type="text" />
                                    </label>
                                </TabsContent>
                                <TabsContent value="organization" className="flex flex-col gap-3">
                                    {/* Name */}
                                    <label className="grid grid-cols-[110px_1fr] items-center gap-3">
                                        <span className="flex flex-col leading-4 text-sm">
                                            Name
                                            <span className="text-xs text-muted-foreground">Recommended</span>
                                        </span>
                                        <Input placeholder="Name" type="text" />
                                    </label>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </details>
                ))}
                <div className="flex gap-3 items-center">
                    <Button variant="secondary" className="gap-2">
                        <UserRound size={17} strokeWidth={1.5} />
                        <span className="leading-none">Add Person</span>
                    </Button>
                    <Button variant="secondary" className="gap-2">
                        <Building2 size={17} strokeWidth={1.5} />
                        <span className="leading-none">Add Organization</span>
                    </Button>
                </div>
            </div>

        </div>
    )
}

const Line = ({ className }: { className?: string }) => <div className={cn("h-[1px] w-full bg-border", className)} />

export default function EditCitationForm({ source }: { source: Source }) {
    return (
        <div className="flex flex-col gap-4 w-full">
            <label className="grid grid-cols-[120px_1fr] items-center gap-3">
                <span className="flex flex-col leading-4 text-sm">
                    Title
                    <span className="text-xs text-muted-foreground">Required</span>
                </span>
                <Input placeholder="Title" type="text" value={source.citationInfo.sourceTitle} />
            </label>
            <label className="grid grid-cols-[120px_1fr] items-center gap-3">
                <span className="flex flex-col leading-4 text-sm">
                    Website name
                </span>
                <Input placeholder="Title" type="text" value={source.citationInfo.publisher} />
            </label>
            <Line className="my-2" />
            <Contributors source={source} />
            <Line className="my-2" />
            <label className="grid grid-cols-[120px_1fr] items-center gap-3">
                <span className="flex flex-col leading-4 text-sm">
                    URL
                    <span className="text-xs text-muted-foreground">Recommended</span>
                </span>
                <Input placeholder="URL" type="text" value={source.citationInfo.url} />
            </label>
        </div>
    )
}
