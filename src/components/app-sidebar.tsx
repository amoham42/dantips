import * as React from "react"
import Link from "next/link"
import {
  Sidebar,
  SidebarContent,

  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,

} from "@/components/ui/sidebar"
import { ThreadList } from "./assistant-ui/thread-list"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="justify-center"
            >
              <Link href="https://dantips.com" target="_blank">
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold text-xl">Dantips</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <ThreadList />
      </SidebarContent>
      
      <SidebarRail />
    </Sidebar>
  )
}
