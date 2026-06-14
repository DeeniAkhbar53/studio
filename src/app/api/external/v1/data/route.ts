import { NextRequest, NextResponse } from 'next/server';
import { db, getYearPath } from '@/lib/firebase/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  doc, 
  updateDoc, 
  increment,
  collectionGroup 
} from 'firebase/firestore';

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

    // 3. Restrict access if the key status is not active
    if (keyData.status !== 'active') {
      return NextResponse.json(
        { 
          error: 'Forbidden.', 
          message: 'API access has been restricted. Please contact the administrator to reactivate your key.' 
        },
        { status: 403 }
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

    // Extract API key permissions
    const targetMohallahId = keyData.mohallahId || 'all';
    const targetAccessLevel = keyData.accessLevel || 'read_stats';

    // 4. Retrieve active Hijri year (defaulting to 1448H if not specified)
    const activeYear = req.cookies.get('active_year')?.value || '1448H';

    // 5. Fetch and filter members list based on key rights
    let mohallahItsIds: Set<string> | null = null;
    let membersData: any[] = [];

    if (targetMohallahId !== 'all') {
      // Fetch members of specific Mohallah for scoping stats and member directory
      const membersColRef = collection(db, 'mohallahs', targetMohallahId, 'members');
      const membersSnap = await getDocs(membersColRef);
      mohallahItsIds = new Set(membersSnap.docs.map(doc => doc.data().itsId));

      if (targetAccessLevel === 'read_members') {
        membersData = membersSnap.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            itsId: data.itsId,
            name: data.name || '',
            email: data.email || null,
            team: data.team || null,
            designation: data.designation || 'Member',
            role: data.role || 'user',
            mohallahId: targetMohallahId
          };
        });
      }
    } else {
      // Open scope - if client asks for member lists, fetch all members across all mohallahs
      if (targetAccessLevel === 'read_members') {
        const membersQuery = query(collectionGroup(db, 'members'));
        const membersSnap = await getDocs(membersQuery);
        membersData = membersSnap.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            itsId: data.itsId,
            name: data.name || '',
            email: data.email || null,
            team: data.team || null,
            designation: data.designation || 'Member',
            role: data.role || 'user',
            mohallahId: docSnap.ref.parent.parent?.id || null
          };
        });
      }
    }

    // 6. Fetch Miqaat events from Firestore
    const miqaatsColRef = collection(db, getYearPath('miqaats', activeYear));
    const miqaatsSnap = await getDocs(miqaatsColRef);

    // Filter and sanitize Miqaat data to respect scope and protect privacy
    const miqaatsData = miqaatsSnap.docs
      .map(docSnap => {
        const data = docSnap.data();

        // If API key is scoped to a specific Mohallah, check if Miqaat is eligible for it
        if (targetMohallahId !== 'all') {
          if (data.mohallahIds && data.mohallahIds.length > 0 && !data.mohallahIds.includes(targetMohallahId)) {
            return null; // Skip this event (belongs to another Mohallah)
          }
        }

        // Calculate counts based on key scope
        let attendanceCount = 0;
        let safarCount = 0;

        if (mohallahItsIds !== null) {
          // Scoped Stats: Only count attendance entries of members in the scoped Mohallah
          attendanceCount = (data.attendance || []).filter((a: any) => mohallahItsIds!.has(a.userItsId)).length;
          safarCount = (data.safarList || []).filter((s: any) => mohallahItsIds!.has(s.userItsId)).length;
        } else {
          // Global Stats: Count all attendance entries
          attendanceCount = data.attendance?.length || 0;
          safarCount = data.safarList?.length || 0;
        }

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
      })
      .filter(Boolean); // Clear out skipped null items

    // 7. Return response
    return NextResponse.json({
      success: true,
      clientName: keyData.clientName || 'Developer Partner',
      activeYear,
      data: {
        miqaats: miqaatsData,
        ...(targetAccessLevel === 'read_members' ? { members: membersData } : {})
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
