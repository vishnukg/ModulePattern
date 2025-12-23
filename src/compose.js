import modules from "./modules/index.js";

export default () => {
  const reserve = modules.restaurant.reserve();
  const restaurant = { reserve };
  return { restaurant };
};
