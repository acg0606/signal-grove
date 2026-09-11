// Public project presentation, not recorded gameplay or proof of real multiplayer.
export default async ({ project }) => {
  const p = await project({ dir: 'arena-presentation', size: '1280x720', fps: 24, background: '#101126' });
  const cover = await p.add('cover.png');
  const colors = ['#ff72ce','#e6ff72','#6febde','#bb9aff','#ffb366','#67caff'];
  const pages = [
    ['FIND YOUR MUSIC CREW', 'AFFINITY\nARENA', 'A social rhythm festival\nin Decentraland.', 'PROJECT PRESENTATION / NOT GAMEPLAY FOOTAGE'],
    ['01 / CHOOSE TOGETHER / 30s', 'YOUR TASTE.\nYOUR TEAM.', 'K-pop / Brazilian Funk / Latin Urban\nAfrobeats / Hip-hop / Electronic', 'Six themed studios. Shared identity. Equal gameplay rules.'],
    ['02 / REHEARSE / 30s', 'BUILD YOUR\nHARMONY.', 'Read the C / E / G score.\nTap together. Develop your attributes.', 'Rhythm / Precision / Harmony / Consistency'],
    ['03 / LIVE FINAL / 30s', 'OWN THE\nSTAGE.', 'The two qualifying crews perform.\nLive performance counts twice.', 'Spectators watch and queue for the next festival.'],
    ['BUILT FOR A SHARED WORLD', 'SMALL SCREENS.\nBIG ENERGY.', 'Touch pads. World-space scores.\nFront stage monitors. Original audio.', 'Published beta / latest device, multiplayer and persistence acceptance pending'],
    ['PLAY THE PUBLISHED BETA', 'MEET US\nIN THE WORLD.', 'Decentraland Mobile\nWorld: mitthie.dcl.eth', 'DoraHacks BUIDL 48375 / Friendzone submission under review']
  ];
  for (let i=0;i<pages.length;i++) {
    const [label,title,body,foot]=pages[i], accent=colors[i];
    p.compose(
      <frame x={0} y={0} width={1280} height={720} layout="none" background="#101126"
        motion={{enter:{from:{opacity:0,y:12},duration:0.45},exit:{to:{opacity:0},duration:0.3,anchor:'end'}}}>
        <rect x={0} y={0} width={14} height={720} fill={accent}/>
        <text x={56} y={40} width={1160} height={45} fontFamily="Bebas Neue" fontSize={30} letterSpacing={2} color={accent}>{label}</text>
        <text x={56} y={128} width={775} height={260} fontFamily="Bebas Neue" fontSize={92} lineHeight={1.0} color="#ffffff">{title}</text>
        <text x={60} y={392} width={750} height={132} fontFamily="Montserrat" fontSize={30} lineHeight={1.4} color="#e6e7f5">{body}</text>
        <frame x={860} y={143} width={354} height={354} radius={28} clip={true} layout="none">
          <media x={0} y={0} file={cover} width={354} height={354} fit="cover"/>
        </frame>
        <rect x={60} y={567} width={1154} height={2} fill="#383c58"/>
        <text x={60} y={590} width={1150} height={65} fontFamily="Montserrat" fontSize={20} lineHeight={1.2} color="#c9cde7">{foot}</text>
        <rect x={60} y={676} width={1154} height={5} fill={accent} animate={[{property:'scaleX',from:0.01,to:1,duration:7,easing:'linear'}]}/>
        <text x={1070} y={522} width={144} height={32} fontFamily="Montserrat" fontSize={15} color="#c9cde7">Brand artwork</text>
      </frame>, {at:i*7,dur:7,name:`Page ${i+1}`}
    );
  }
  await p.frame(17,'renders/rehearsal.png');
  await p.render('renders/affinity-arena-presentation-silent.mp4',{depth:8,bitrate:'3M',concurrency:2});
};
