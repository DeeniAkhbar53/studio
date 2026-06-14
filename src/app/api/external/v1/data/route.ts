import { NextRequest, NextResponse } from 'next/server';
import { db, getYearPath } from '@/lib/firebase/firebase';
import { collection, query, where, getDocs, limit, doc, updateDoc, increment } from 'firebase/firestore';

export async function GET(req: NextRequest) {
  try {
    // 1. Extract API Key from headers
    const apiKey = req.headers.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized. Missing API key in x-api-key header.' },
        { status: 401 }
      );
    }

    // 2. Query the api_keys collection to find the key
    const apiKeysRef = collection(db, 'api_keys');
    const keyQuery = query(apiKeysRef, where('key', '==', apiKey), limit(1));
    const keySnap = await getDocs(keyQuery);

    if (keySnap.empty) {
      return NextResponse.json(
        { error: 'Unauthorized. Invalid API key.' },
        { status: 403 }
      );
    }

    const keyDoc = keySnap.docs[0];
    const keyData = keyDoc.data();

    // 3. Restrict access if the key status is not active (due to unpaid subscription or suspension)
    if (keyData.status !== 'active') {
      return NextResponse.json(
        { 
          error: 'Payment Required or Key Suspended.', 
          message: 'API access has been restricted. Please complete your payment or contact the administrator to reactivate your key.' 
        },
        { status: 402 } // HTTP 402 Payment Required is the standard code for unpaid APIs
      );
    }

    // Increment request count in the background for usage analytics
    try {
      const docRef = doc(db, 'api_keys', keyDoc.id);
      await updateDoc(docRef, {
        requestCount: increment(1)
      });
    } catch (countErr) {
      console.error('Failed to increment API key usage count:', countErr);
    }

    // 4. Retrieve active Hijri year (defaulting to 1448H if not specified)
    const activeYear = req.cookies.get('active_year')?.value || '1448H';

    // 5. Fetch Miqaat events from Firestore
    const miqaatsColRef = collection(db, getYearPath('miqaats', activeYear));
    const miqaatsSnap = await getDocs(miqaatsColRef);

    // Filter and sanitize the data to protect user privacy (expose counts, not personal details)
    const miqaatsData = miqaatsSnap.docs.map(docSnap => {
      const data = docSnap.data();
      const attendanceCount = data.attendance?.length || 0;
      const safarCount = data.safarList?.length || 0;

      return {
        id: docSnap.id,
        name: data.name || '',
        location: data.location || '',
        type: data.type || 'local',
        startTime: data.startTime || '',
        endTime: data.endTime || '',
        stats: {
          presentCount: attendanceCount,
          safarCount: safarCount,
          totalMarked: attendanceCount + safarCount
        }
      };
    });

    // 6. Return response
    return NextResponse.json({
      success: true,
      clientName: keyData.clientName || 'Developer Partner',
      activeYear,
      data: {
        miqaats: miqaatsData
      }
    });

  } catch (error: any) {
    console.error('External API Data error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve data.', details: error.message || error },
      { status: 500 }
    );
  }
}
