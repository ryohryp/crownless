from .crownless_recipe import CrownlessRecipeExtension
from krita import Krita

Krita.instance().addExtension(CrownlessRecipeExtension(Krita.instance()))
