import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { LeadStatus, LeadSubStatus } from "@/types/leadStatus";
import { isHotLead, getPriorityLevel } from "@/lib/statusHelpers";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get('count') === 'true';
    const limit = parseInt(searchParams.get('limit') || '10');
    
    // Get all leads with their details
    const leads = await db.lead.findMany({
      include: {
        LeadTag: {
          include: {
            tag: true
          }
        },
        SendLog: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        },
        replies: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Filter hot leads
    const hotLeads = leads.filter(lead => {
      return isHotLead(lead.status as LeadStatus, lead.subStatus as LeadSubStatus | null);
    });
    
    // Sort by priority and creation date
    const sortedHotLeads = hotLeads.sort((a, b) => {
      const priorityA = getPriorityLevel(a.status as LeadStatus, a.subStatus as LeadSubStatus | null);
      const priorityB = getPriorityLevel(b.status as LeadStatus, b.subStatus as LeadSubStatus | null);
      
      const priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      const priorityDiff = priorityOrder[priorityB] - priorityOrder[priorityA];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // If same priority, sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    // If count only, return just the count
    if (countOnly) {
      return NextResponse.json({
        success: true,
        count: hotLeads.length
      });
    }
    
    // Format leads for response
    const formattedLeads = sortedHotLeads.slice(0, limit).map(lead => {
      const lastActivity = lead.replies[0]?.createdAt || lead.SendLog[0]?.createdAt;
      
      return {
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        company: lead.company,
        status: lead.status,
        subStatus: lead.subStatus,
        source: lead.source || 'CSV_IMPORT',
        createdAt: lead.createdAt.toISOString(),
        lastActivity: lastActivity?.toISOString(),
        priority: getPriorityLevel(lead.status as LeadStatus, lead.subStatus as LeadSubStatus | null),
        tags: lead.LeadTag.map(lt => lt.tag.name),
        blockedCampaigns: lead.blockedCampaigns ? JSON.parse(lead.blockedCampaigns) : []
      };
    });
    
    return NextResponse.json({
      success: true,
      leads: formattedLeads,
      total: hotLeads.length,
      count: hotLeads.length
    });
    
  } catch (error: any) {
    console.error("Błąd pobierania hot leads:", error);
    return NextResponse.json({ 
      error: "Błąd pobierania hot leads", 
      details: error.message 
    }, { status: 500 });
  }
}
