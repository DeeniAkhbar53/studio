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
  collectionGroup,
  getDoc,
  Timestamp
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

    // 4. Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const resource = searchParams.get('resource') || 'all';
    const yearParam = searchParams.get('year') || req.cookies.get('active_year')?.value || '1448H';

    const itsId = searchParams.get('itsId') || null;
    const miqaatId = searchParams.get('miqaatId') || null;
    const formId = searchParams.get('formId') || null;

    // Filters
    const teamFilter = searchParams.get('team') || null;
    const roleFilter = searchParams.get('role') || null;
    const designationFilter = searchParams.get('designation') || null;
    const statusFilter = searchParams.get('status') || null;
    const typeFilter = searchParams.get('type') || null;

    // Validate resource
    const validResources = ['all', 'members', 'miqaats', 'forms', 'mohallahs', 'teams'];
    if (!validResources.includes(resource)) {
      return NextResponse.json(
        { error: `Invalid resource. Supported resources: ${validResources.join(', ')}` },
        { status: 400 }
      );
    }

    // Helper: Fetch ITS IDs of members in the scoped Mohallah to calculate stats
    let mohallahItsIds: Set<string> | null = null;
    if (targetMohallahId !== 'all') {
      const membersColRef = collection(db, 'mohallahs', targetMohallahId, 'members');
      const membersSnap = await getDocs(membersColRef);
      mohallahItsIds = new Set(membersSnap.docs.map(doc => doc.data().itsId));
    }

    const responseData: any = {};

    // -------------------------------------------------------------
    // FETCH RESOURCE: MEMBERS
    // -------------------------------------------------------------
    if (resource === 'members' || resource === 'all') {
      const isExplicitMembers = resource === 'members';
      
      if (targetAccessLevel !== 'read_members') {
        if (isExplicitMembers) {
          return NextResponse.json(
            { error: 'Forbidden. The API key does not have permission to read member directory.' },
            { status: 403 }
          );
        }
      } else {
        const sanitizeMember = (data: any, docId: string, parentMohallahId: string | null) => ({
          id: docId,
          itsId: data.itsId,
          name: data.name || '',
          email: data.email || null,
          team: data.team || null,
          designation: data.designation || 'Member',
          role: data.role || 'user',
          mohallahId: parentMohallahId
        });

        if (itsId) {
          // Single member lookup
          let memberDoc = null;
          if (targetMohallahId !== 'all') {
            const membersCol = collection(db, 'mohallahs', targetMohallahId, 'members');
            const q = query(membersCol, where('itsId', '==', itsId), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) memberDoc = snap.docs[0];
          } else {
            const q = query(collectionGroup(db, 'members'), where('itsId', '==', itsId), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) memberDoc = snap.docs[0];
          }

          if (memberDoc) {
            responseData.member = sanitizeMember(
              memberDoc.data(), 
              memberDoc.id, 
              memberDoc.ref.parent.parent?.id || null
            );
          } else {
            return NextResponse.json({ error: `Member with ITS ID ${itsId} not found.` }, { status: 404 });
          }
        } else {
          // List members lookup
          let membersSnap;
          if (targetMohallahId !== 'all') {
            const membersCol = collection(db, 'mohallahs', targetMohallahId, 'members');
            membersSnap = await getDocs(membersCol);
          } else {
            const q = query(collectionGroup(db, 'members'));
            membersSnap = await getDocs(q);
          }

          let membersList = membersSnap.docs.map(docSnap => 
            sanitizeMember(docSnap.data(), docSnap.id, docSnap.ref.parent.parent?.id || null)
          );

          // Apply filters
          if (teamFilter) {
            membersList = membersList.filter(m => m.team?.toLowerCase() === teamFilter.toLowerCase());
          }
          if (roleFilter) {
            membersList = membersList.filter(m => m.role?.toLowerCase() === roleFilter.toLowerCase());
          }
          if (designationFilter) {
            membersList = membersList.filter(m => m.designation?.toLowerCase() === designationFilter.toLowerCase());
          }

          responseData.members = membersList;
        }
      }
    }

    // -------------------------------------------------------------
    // FETCH RESOURCE: MIQAATS
    // -------------------------------------------------------------
    if (resource === 'miqaats' || resource === 'all') {
      const sanitizeMiqaat = (docId: string, data: any) => {
        let attendanceCount = 0;
        let safarCount = 0;

        if (mohallahItsIds !== null) {
          attendanceCount = (data.attendance || []).filter((a: any) => mohallahItsIds!.has(a.userItsId)).length;
          safarCount = (data.safarList || []).filter((s: any) => mohallahItsIds!.has(s.userItsId)).length;
        } else {
          attendanceCount = data.attendance?.length || 0;
          safarCount = data.safarList?.length || 0;
        }

        return {
          id: docId,
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
      };

      if (miqaatId) {
        // Single miqaat lookup
        const miqaatDocRef = doc(db, getYearPath('miqaats', yearParam), miqaatId);
        const miqaatSnap = await getDoc(miqaatDocRef);

        if (!miqaatSnap.exists()) {
          return NextResponse.json({ error: `Miqaat with ID ${miqaatId} not found under year ${yearParam}.` }, { status: 404 });
        }

        const data = miqaatSnap.data();
        if (targetMohallahId !== 'all') {
          if (data.mohallahIds && data.mohallahIds.length > 0 && !data.mohallahIds.includes(targetMohallahId)) {
            return NextResponse.json({ error: 'Forbidden. This Miqaat is not scoped for your Mohallah.' }, { status: 403 });
          }
        }

        responseData.miqaat = sanitizeMiqaat(miqaatSnap.id, data);
      } else {
        // List miqaats lookup
        const miqaatsColRef = collection(db, getYearPath('miqaats', yearParam));
        const miqaatsSnap = await getDocs(miqaatsColRef);

        let miqaatsList = miqaatsSnap.docs
          .map(docSnap => {
            const data = docSnap.data();
            if (targetMohallahId !== 'all') {
              if (data.mohallahIds && data.mohallahIds.length > 0 && !data.mohallahIds.includes(targetMohallahId)) {
                return null;
              }
            }
            return sanitizeMiqaat(docSnap.id, data);
          })
          .filter(Boolean);

        if (typeFilter) {
          miqaatsList = miqaatsList.filter(m => m && m.type?.toLowerCase() === typeFilter.toLowerCase());
        }

        responseData.miqaats = miqaatsList;
      }
    }

    // -------------------------------------------------------------
    // FETCH RESOURCE: FORMS
    // -------------------------------------------------------------
    if (resource === 'forms' || resource === 'all') {
      const sanitizeForm = (docId: string, data: any) => ({
        id: docId,
        title: data.title || '',
        description: data.description || '',
        status: data.status || 'open',
        endDate: data.endDate instanceof Timestamp ? data.endDate.toDate().toISOString() : data.endDate || null,
        responseCount: data.responseCount || 0,
        questions: (data.questions || []).map((q: any) => ({
          id: q.id,
          label: q.label,
          type: q.type,
          required: q.required,
          options: q.options || null
        })),
        mohallahIds: data.mohallahIds || [],
        teams: data.teams || []
      });

      if (formId) {
        // Single form lookup
        const formDocRef = doc(db, getYearPath('forms', yearParam), formId);
        const formSnap = await getDoc(formDocRef);

        if (!formSnap.exists()) {
          return NextResponse.json({ error: `Form with ID ${formId} not found under year ${yearParam}.` }, { status: 404 });
        }

        const data = formSnap.data();
        if (targetMohallahId !== 'all') {
          if (data.mohallahIds && data.mohallahIds.length > 0 && !data.mohallahIds.includes(targetMohallahId)) {
            return NextResponse.json({ error: 'Forbidden. This form is not scoped for your Mohallah.' }, { status: 403 });
          }
        }

        responseData.form = sanitizeForm(formSnap.id, data);
      } else {
        // List forms lookup
        const formsColRef = collection(db, getYearPath('forms', yearParam));
        const formsSnap = await getDocs(formsColRef);

        let formsList = formsSnap.docs
          .map(docSnap => {
            const data = docSnap.data();
            if (targetMohallahId !== 'all') {
              if (data.mohallahIds && data.mohallahIds.length > 0 && !data.mohallahIds.includes(targetMohallahId)) {
                return null;
              }
            }
            return sanitizeForm(docSnap.id, data);
          })
          .filter(Boolean);

        if (statusFilter) {
          formsList = formsList.filter(f => f && f.status?.toLowerCase() === statusFilter.toLowerCase());
        }

        responseData.forms = formsList;
      }
    }

    // -------------------------------------------------------------
    // FETCH RESOURCE: MOHALLAHS
    // -------------------------------------------------------------
    if (resource === 'mohallahs' || resource === 'all') {
      if (targetMohallahId !== 'all') {
        const docRef = doc(db, 'mohallahs', targetMohallahId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          responseData.mohallahs = [{ id: snap.id, name: snap.data().name }];
        } else {
          responseData.mohallahs = [{ id: targetMohallahId, name: 'Scoped Mohallah' }];
        }
      } else {
        const mohallahsCol = collection(db, 'mohallahs');
        const snap = await getDocs(mohallahsCol);
        responseData.mohallahs = snap.docs.map(docSnap => ({
          id: docSnap.id,
          name: docSnap.data().name
        }));
      }
    }

    // -------------------------------------------------------------
    // FETCH RESOURCE: TEAMS
    // -------------------------------------------------------------
    if (resource === 'teams' || resource === 'all') {
      if (targetMohallahId !== 'all') {
        const teamsCol = collection(db, 'mohallahs', targetMohallahId, 'teams');
        const snap = await getDocs(teamsCol);
        responseData.teams = snap.docs.map(docSnap => ({
          name: decodeURIComponent(docSnap.id),
          mohallahId: targetMohallahId
        }));
      } else {
        // Fetch teams for all mohallahs using Promise.all to avoid collectionGroup index dependency
        const mohallahsCol = collection(db, 'mohallahs');
        const mohallahsSnap = await getDocs(mohallahsCol);
        
        const teamFetchPromises = mohallahsSnap.docs.map(async (mDoc) => {
          const teamsCol = collection(db, 'mohallahs', mDoc.id, 'teams');
          const snap = await getDocs(teamsCol);
          return snap.docs.map(tDoc => ({
            name: decodeURIComponent(tDoc.id),
            mohallahId: mDoc.id
          }));
        });
        
        const teamsLists = await Promise.all(teamFetchPromises);
        responseData.teams = teamsLists.flat();
      }
    }

    // 5. Return response
    return NextResponse.json({
      success: true,
      clientName: keyData.clientName || 'Developer Partner',
      activeYear: yearParam,
      data: responseData
    });

  } catch (error: any) {
    console.error('External API Data error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve data.', details: error.message || error },
      { status: 500 }
    );
  }
}
