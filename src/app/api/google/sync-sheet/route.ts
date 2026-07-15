import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const { sheetId, sheetName, headers, data, action } = await req.json();

    if (!sheetId) {
      return NextResponse.json({ error: 'Google Sheet ID is required.' }, { status: 400 });
    }

    // Retrieve the Google Apps Script Webapp URL from app settings
    const appConfigDocRef = doc(db, 'app_settings', 'appConfig');
    const docSnap = await getDoc(appConfigDocRef);
    const scriptUrl = docSnap.exists() ? docSnap.data().googleSheetsAppsScriptUrl : null;

    if (!scriptUrl || !scriptUrl.trim()) {
      return NextResponse.json({ 
        error: 'Google Sheets sync URL is not configured. Please configure it in Settings.' 
      }, { status: 400 });
    }

    // Prepare rows including the header
    const rows = [headers, ...data];

    // Post to Google Apps Script
    const response = await fetch(scriptUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sheetId: sheetId.trim(),
        sheetName: sheetName || 'SyncData',
        rows,
        action: action || 'replace', // 'replace' or 'append'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `Apps Script returned error: ${errorText}` }, { status: response.status });
    }

    const responseText = await response.text();
    let result;
    try {
        result = JSON.parse(responseText);
    } catch (e) {
        console.error("Failed to parse Google Apps Script response as JSON. Response was HTML:", responseText.substring(0, 200));
        return NextResponse.json({ 
            error: 'Google Apps Script returned an HTML page instead of JSON. Ensure your script is deployed as a Web App with "Execute as: Me" and "Who has access: Anyone".' 
        }, { status: 500 });
    }
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Apps Script sync failed.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Data synced successfully!' });
  } catch (error: any) {
    console.error('Google Sheets Sync API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to sync with Google Sheets.' }, { status: 500 });
  }
}
