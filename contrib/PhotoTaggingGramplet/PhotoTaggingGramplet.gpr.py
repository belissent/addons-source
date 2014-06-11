register(GRAMPLET, 
         id="Photo Tagging", 
         name=_("Photo Tagging"), 
         description = _("Gramplet for tagging people in photos"),
         version = '1.0.6',
         gramps_target_version="4.1",
         status = UNSTABLE,
         fname="PhotoTaggingGramplet.py",
         height=400,
         gramplet = 'PhotoTaggingGramplet',
         gramplet_title=_("Photo Tagging"),
         navtypes=["Media"],
         )
